package feature

import (
	"math"
	"math/rand"

	"GOMODULE/core"
)

// Automatic retry of transient failures with exponential backoff and
// jitter. Wraps the active transport so a single operation call may make
// several HTTP attempts. A failure is retryable when the transport returns
// an error, or responds with a status in `statuses`
// (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
// `Retry-After` header overrides the computed backoff.
type RetryFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._retry record).
	Attempts int
	Retries  []map[string]any
}

func NewRetryFeature() *RetryFeature {
	return &RetryFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "retry",
			Active:  true,
		},
	}
}

func (f *RetryFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.withRetry(ctx2, url, fetchdef, inner)
	}
}

func (f *RetryFeature) withRetry(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	max := foptInt(f.options, "retries", 2)
	minDelay := foptInt(f.options, "minDelay", 50)
	maxDelay := foptInt(f.options, "maxDelay", 2000)
	factor := foptNum(f.options, "factor", 2)

	attempt := 0

	for {
		res, err := inner(ctx, url, fetchdef)

		if !f.retryable(res, err) || attempt >= max {
			// Out of attempts (or not retryable): return the last
			// response/error as-is to preserve pipeline semantics.
			return res, err
		}

		wait := f.backoff(res, attempt, minDelay, maxDelay, factor)
		f.track(attempt+1, res, err, wait)
		f.sleep(wait)
		attempt++
	}
}

func (f *RetryFeature) retryable(res any, err error) bool {
	if err != nil {
		return true
	}
	if res == nil {
		return true
	}
	status, ok := fresStatus(res)
	if !ok {
		return false
	}
	statuses := foptList(f.options, "statuses")
	if statuses == nil {
		statuses = []any{408, 425, 429, 500, 502, 503, 504}
	}
	for _, s := range statuses {
		switch n := s.(type) {
		case int:
			if n == status {
				return true
			}
		case int64:
			if int(n) == status {
				return true
			}
		case float64:
			if int(n) == status {
				return true
			}
		}
	}
	return false
}

func (f *RetryFeature) backoff(res any, attempt int, minDelay int, maxDelay int, factor float64) int {
	// Honour a server-provided Retry-After (seconds) when present.
	if ra, ok := f.retryAfter(res); ok {
		if ra > maxDelay {
			return maxDelay
		}
		return ra
	}
	base := float64(minDelay) * math.Pow(factor, float64(attempt))
	jitter := 0
	if foptBool(f.options, "jitter", true) && minDelay > 0 {
		jitter = rand.Intn(minDelay)
	}
	wait := int(base) + jitter
	if wait > maxDelay {
		return maxDelay
	}
	return wait
}

func (f *RetryFeature) retryAfter(res any) (int, bool) {
	v, ok := fresHeader(res, "retry-after")
	if !ok {
		return 0, false
	}
	seconds := fparseInt(v, -1)
	if seconds < 0 {
		return 0, false
	}
	return seconds * 1000, true
}

func (f *RetryFeature) sleep(ms int) {
	if ms <= 0 {
		return
	}
	foptSleep(f.options)(ms)
}

func (f *RetryFeature) track(attempt int, res any, err error, wait int) {
	f.Attempts++

	entry := map[string]any{
		"attempt": attempt,
		"wait":    wait,
	}
	if status, ok := fresStatus(res); ok {
		entry["status"] = status
	}
	if err != nil {
		entry["error"] = err.Error()
	}
	f.Retries = append(f.Retries, entry)
}
