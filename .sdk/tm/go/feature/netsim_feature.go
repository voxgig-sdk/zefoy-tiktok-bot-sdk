package feature

import (
	"fmt"

	"GOMODULE/core"
)

// Network behaviour simulation. Wraps the active transport (the live
// net/http fetch or the `test` feature's in-memory mock) and injects
// realistic network conditions so offline unit tests can exercise slowness,
// transient failures, rate limiting and outages deterministically.
//
// Every injection mode is counter-driven (per client instance) so tests
// are reproducible without mocking timers. `failRate` adds optional
// pseudo-random failures via a seeded LCG for coverage-style testing.
type NetsimFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	seed    int64

	// Activity tracking (mirrors the ts client._netsim record).
	Calls   int
	Applied []map[string]any
}

func NewNetsimFeature() *NetsimFeature {
	return &NetsimFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "netsim",
			Active:  true,
		},
	}
}

func (f *NetsimFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	f.seed = int64(foptInt(f.options, "seed", 0))
	if f.seed == 0 {
		f.seed = 1
	}

	if !f.Active {
		return
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.simulate(ctx2, url, fetchdef, inner)
	}
}

func (f *NetsimFeature) simulate(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	opts := f.options
	f.Calls++
	call := f.Calls

	// Record the simulated conditions for test/debug inspection.
	applied := map[string]any{}

	// Total outage: every call fails at the transport level.
	if foptBool(opts, "offline", false) {
		f.sleep(f.pickLatency())
		applied["offline"] = true
		f.track(ctx, applied)
		return nil, ctx.MakeError("netsim_offline",
			"Simulated network offline (URL was: \""+url+"\")")
	}

	// Connection-level errors for the first N calls (e.g. ECONNRESET).
	if call <= foptInt(opts, "errorTimes", 0) {
		f.sleep(f.pickLatency())
		applied["error"] = true
		f.track(ctx, applied)
		return nil, ctx.MakeError("netsim_conn",
			fmt.Sprintf("Simulated connection error (call %d)", call))
	}

	// Rate-limit responses (HTTP 429 + Retry-After) for the first N calls.
	if call <= foptInt(opts, "rateLimitTimes", 0) {
		f.sleep(f.pickLatency())
		applied["rateLimited"] = true
		f.track(ctx, applied)
		return f.respond(429, nil, map[string]any{
			"statusText": "Too Many Requests",
			"headers": map[string]any{
				"retry-after": fmt.Sprintf("%d", foptInt(opts, "retryAfter", 0)),
			},
		}), nil
	}

	// Retryable failure status for the first N calls, or every Nth call,
	// or pseudo-randomly at `failRate`.
	failStatus := foptInt(opts, "failStatus", 503)
	failEvery := foptInt(opts, "failEvery", 0)
	failByCount := call <= foptInt(opts, "failTimes", 0)
	failByEvery := failEvery > 0 && call%failEvery == 0
	failRate := foptNum(opts, "failRate", 0)
	failByRate := failRate > 0 && f.rand() < failRate
	if failByCount || failByEvery || failByRate {
		f.sleep(f.pickLatency())
		applied["failStatus"] = failStatus
		f.track(ctx, applied)
		return f.respond(failStatus, nil, map[string]any{
			"statusText": "Simulated Failure",
		}), nil
	}

	// Otherwise: apply latency then delegate to the real transport.
	latency := f.pickLatency()
	applied["latency"] = latency
	f.track(ctx, applied)
	f.sleep(latency)
	return inner(ctx, url, fetchdef)
}

// pickLatency yields ms: a fixed number, or a uniform sample from {min,max}.
func (f *NetsimFeature) pickLatency() int {
	l, has := f.options["latency"]
	if !has || l == nil {
		return 0
	}
	if lm, ok := l.(map[string]any); ok {
		min := foptInt(lm, "min", 0)
		max := foptInt(lm, "max", min)
		if max <= min {
			return min
		}
		return min + int(f.rand()*float64(max-min))
	}
	fixed := foptInt(f.options, "latency", 0)
	if fixed < 0 {
		return 0
	}
	return fixed
}

func (f *NetsimFeature) sleep(ms int) {
	if ms <= 0 {
		return
	}
	foptSleep(f.options)(ms)
}

// rand yields a deterministic 0..1 pseudo-random via a linear congruential
// generator.
func (f *NetsimFeature) rand() float64 {
	f.seed = (f.seed*1103515245 + 12345) & 0x7fffffff
	return float64(f.seed) / float64(0x7fffffff)
}

func (f *NetsimFeature) track(ctx *core.Context, applied map[string]any) {
	f.Applied = append(f.Applied, applied)
	if ctx.Ctrl != nil && ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["netsim"] = map[string]any{
			"calls":   f.Calls,
			"applied": f.Applied,
		}
	}
}

// respond builds a transport-shaped response (matching the test feature's
// mock) that the result pipeline understands.
func (f *NetsimFeature) respond(status int, data any, extra map[string]any) map[string]any {
	out := map[string]any{
		"status":     status,
		"statusText": "OK",
		"json":       (func() any)(func() any { return data }),
		"body":       "not-used",
		"headers":    map[string]any{},
	}
	for k, v := range extra {
		out[k] = v
	}
	return out
}
