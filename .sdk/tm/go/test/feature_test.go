package sdktest

// Offline feature-test harness plus behavioural tests for the enterprise
// features shipped with this SDK (retry, cache, rbac, telemetry, ...).
//
// Feature behaviour is unit-tested by driving each feature through a
// faithful miniature of the real operation pipeline against a configurable
// mock transport — the same hook order and short-circuit rules as the
// generated Entity*Op code, but with no live server and no API-specific
// fixtures. Each block runs only when its feature is present in this SDK
// (see fhSkipWithout).

import (
	"fmt"
	neturl "net/url"
	"os"
	"reflect"
	"regexp"
	"sort"
	"strings"
	"testing"
	"time"

	sdk "GOMODULE"
	feat "GOMODULE/feature"
)

// --- harness ----------------------------------------------------------------

// fhHasFeature is true when this SDK was generated with the named feature.
func fhHasFeature(name string) bool {
	config := sdk.MakeConfig()
	fm, _ := config["feature"].(map[string]any)
	return fm != nil && fm[name] != nil
}

func fhSkipWithout(t *testing.T, names ...string) {
	t.Helper()
	for _, name := range names {
		if !fhHasFeature(name) {
			t.Skip("feature not present in this SDK: " + name)
		}
	}
}

// fhClock is a deterministic virtual clock: now() advances only when
// sleep(ms) is called, so timing-based features can be asserted without
// real delays.
type fhClock struct {
	t int64
}

func (c *fhClock) now() int64     { return c.t }
func (c *fhClock) sleep(ms int)   { c.t += int64(ms) }
func (c *fhClock) advance(ms int) { c.t += int64(ms) }

// fhResponse builds a transport-shaped response the pipeline understands.
func fhResponse(status int, data any, headers map[string]any) map[string]any {
	h := map[string]any{}
	for k, v := range headers {
		h[strings.ToLower(k)] = v
	}
	statusText := "OK"
	if status >= 400 {
		statusText = "ERR"
	}
	return map[string]any{
		"status":     status,
		"statusText": statusText,
		"body":       "not-used",
		"json":       (func() any)(func() any { return data }),
		"headers":    h,
	}
}

// fhRecorder is a mock transport recording every call, replying via an
// optional reply func (default: 200 with a call counter).
type fhRecorder struct {
	calls []map[string]any
	reply func(n int, fetchdef map[string]any) (any, error)
}

func (r *fhRecorder) fetch(ctx *sdk.Context, url string, fetchdef map[string]any) (any, error) {
	r.calls = append(r.calls, map[string]any{"url": url, "fetchdef": fetchdef})
	if r.reply != nil {
		return r.reply(len(r.calls), fetchdef)
	}
	return fhResponse(200, map[string]any{"ok": true, "n": len(r.calls)}, nil), nil
}

func (r *fhRecorder) headers(i int) map[string]any {
	fetchdef, _ := r.calls[i]["fetchdef"].(map[string]any)
	headers, _ := fetchdef["headers"].(map[string]any)
	return headers
}

func (r *fhRecorder) fetchdef(i int) map[string]any {
	fetchdef, _ := r.calls[i]["fetchdef"].(map[string]any)
	return fetchdef
}

func (r *fhRecorder) url(i int) string {
	url, _ := r.calls[i]["url"].(string)
	return url
}

// fhFeature pairs a feature instance with its init options.
type fhFeature struct {
	f       sdk.Feature
	options map[string]any
}

func fhF(f sdk.Feature, options map[string]any) fhFeature {
	return fhFeature{f: f, options: options}
}

// fhHarness wires features (in init order) to a mock transport and a mini
// operation pipeline.
type fhHarness struct {
	client  *sdk.ZefoyTiktokBotSDK
	utility *sdk.Utility
	rootctx *sdk.Context
	base    string
}

// fhMake constructs the harness: a real (test-mode) client, an isolated
// utility whose fetcher is the mock server, and the requested features
// initialised against it. Fires PostConstruct once wiring is complete.
func fhMake(server sdk.FetcherFunc, features ...fhFeature) *fhHarness {
	client := sdk.TestSDK(nil, nil)
	client.Features = []sdk.Feature{}

	utility := client.GetUtility()
	if server == nil {
		rec := &fhRecorder{}
		server = rec.fetch
	}
	utility.Fetcher = server

	rootctx := utility.MakeContext(map[string]any{
		"client":  client,
		"utility": utility,
	}, client.GetRootCtx())

	for _, fs := range features {
		fopts := map[string]any{"active": true}
		for k, v := range fs.options {
			fopts[k] = v
		}
		fs.f.Init(rootctx, fopts)
		client.Features = append(client.Features, fs.f)
	}

	utility.FeatureHook(rootctx, "PostConstruct")

	return &fhHarness{
		client:  client,
		utility: utility,
		rootctx: rootctx,
		base:    "http://api.test",
	}
}

type fhOpSpec struct {
	entity  string
	op      string
	method  string
	path    string
	query   map[string]any
	headers map[string]any
	body    any
	ctrl    map[string]any
}

type fhOpResult struct {
	ok     bool
	data   any
	err    error
	result *sdk.Result
	ctx    *sdk.Context
}

func fhDefaultMethod(op string) string {
	switch op {
	case "create":
		return "POST"
	case "update":
		return "PATCH"
	case "remove":
		return "DELETE"
	}
	return "GET"
}

func fhBuildUrl(spec *sdk.Spec) string {
	var keys []string
	for k, v := range spec.Query {
		if v != nil {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)
	qs := ""
	for _, k := range keys {
		if qs != "" {
			qs += "&"
		}
		qs += neturl.QueryEscape(k) + "=" + neturl.QueryEscape(fmt.Sprintf("%v", spec.Query[k]))
	}
	url := spec.Base + spec.Path
	if qs != "" {
		url += "?" + qs
	}
	return url
}

// op runs one operation through the mini pipeline (mirrors the generated
// Entity*Op fragment: hook, short-circuit, make*, hook, ...).
func (h *fhHarness) op(o fhOpSpec) fhOpResult {
	entity := o.entity
	if entity == "" {
		entity = "widget"
	}
	opname := o.op
	if opname == "" {
		opname = "load"
	}
	method := o.method
	if method == "" {
		method = fhDefaultMethod(opname)
	}
	ctrl := o.ctrl
	if ctrl == nil {
		ctrl = map[string]any{}
	}

	ctx := h.utility.MakeContext(map[string]any{
		"opname": opname,
		"ctrl":   ctrl,
	}, h.rootctx)
	ctx.Op = sdk.NewOperation(map[string]any{"entity": entity, "name": opname})

	h.utility.FeatureHook(ctx, "PostConstructEntity")

	h.utility.FeatureHook(ctx, "PrePoint")
	if err, ok := ctx.Out["point"].(error); ok {
		return h.fail(ctx, err)
	}

	h.utility.FeatureHook(ctx, "PreSpec")
	path := o.path
	if path == "" {
		path = "/" + entity
	}
	headers := map[string]any{}
	for k, v := range o.headers {
		headers[k] = v
	}
	query := map[string]any{}
	for k, v := range o.query {
		query[k] = v
	}
	ctx.Spec = sdk.NewSpec(map[string]any{
		"method":  method,
		"base":    h.base,
		"path":    path,
		"headers": headers,
		"query":   query,
		"step":    "start",
	})
	if o.body != nil {
		ctx.Spec.Body = o.body
	}

	h.utility.FeatureHook(ctx, "PreRequest")
	ctx.Spec.Url = fhBuildUrl(ctx.Spec)

	fetchdef := map[string]any{
		"url":     ctx.Spec.Url,
		"method":  ctx.Spec.Method,
		"headers": ctx.Spec.Headers,
	}
	if ctx.Spec.Body != nil {
		fetchdef["body"] = ctx.Spec.Body
	}

	var response any
	var fetchErr error
	if ctx.Out["request"] != nil {
		response = ctx.Out["request"]
	} else {
		response, fetchErr = h.utility.Fetcher(ctx, ctx.Spec.Url, fetchdef)
	}
	if rm, ok := response.(map[string]any); ok {
		ctx.Response = sdk.NewResponse(rm)
	}

	h.utility.FeatureHook(ctx, "PreResponse")
	fhPopulateResult(ctx, response, fetchErr)
	h.utility.FeatureHook(ctx, "PreResult")
	h.utility.FeatureHook(ctx, "PreDone")

	if ctx.Result != nil && ctx.Result.Ok {
		return fhOpResult{ok: true, data: ctx.Result.Resdata, result: ctx.Result, ctx: ctx}
	}

	var err error
	if ctx.Result != nil && ctx.Result.Err != nil {
		err = ctx.Result.Err
	} else {
		err = ctx.MakeError("op_failed", "operation failed")
	}
	return h.fail(ctx, err)
}

func (h *fhHarness) fail(ctx *sdk.Context, err error) fhOpResult {
	ctx.Ctrl.Err = err
	h.utility.FeatureHook(ctx, "PreUnexpected")
	return fhOpResult{ok: false, err: err, result: ctx.Result, ctx: ctx}
}

func fhPopulateResult(ctx *sdk.Context, response any, fetchErr error) {
	result := sdk.NewResult(map[string]any{})
	ctx.Result = result

	if fetchErr != nil {
		result.Err = fetchErr
		return
	}

	rm, ok := response.(map[string]any)
	if !ok || rm == nil {
		result.Err = ctx.MakeError("request_no_response", "response: undefined")
		return
	}

	resp := sdk.NewResponse(rm)
	result.Status = resp.Status
	result.StatusText = resp.StatusText
	if hm, ok := resp.Headers.(map[string]any); ok {
		result.Headers = hm
	}
	if resp.JsonFunc != nil {
		result.Body = resp.JsonFunc()
	}
	result.Resdata = result.Body

	if result.Status >= 400 {
		result.Err = ctx.MakeError("request_status",
			fmt.Sprintf("request: %d: %s", result.Status, result.StatusText))
	} else if resp.Err != nil {
		result.Err = resp.Err
	}
	if result.Err == nil {
		result.Ok = true
	}
}

// fhErrCode extracts the SDK error code, "" otherwise.
func fhErrCode(err error) string {
	if se, ok := err.(*sdk.ZefoyTiktokBotError); ok {
		return se.Code
	}
	return ""
}

// --- netsim -----------------------------------------------------------------

func TestFeatureNetsim(t *testing.T) {
	fhSkipWithout(t, "netsim")

	t.Run("fixed-latency-then-delegate", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"latency": 250, "sleep": clock.sleep}))
		res := h.op(fhOpSpec{op: "load", ctrl: map[string]any{"explain": map[string]any{}}})
		if !res.ok {
			t.Fatalf("expected ok, got err: %v", res.err)
		}
		if clock.t != 250 {
			t.Errorf("expected 250ms latency, got %d", clock.t)
		}
		if f.Calls != 1 {
			t.Errorf("expected 1 call, got %d", f.Calls)
		}
	})

	t.Run("ranged-latency-in-min-max", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"latency": map[string]any{"min": 100, "max": 300},
			"seed":    7,
			"sleep":   clock.sleep,
		}))
		h.op(fhOpSpec{op: "load"})
		if clock.t < 100 || clock.t >= 300 {
			t.Errorf("expected latency in [100,300), got %d", clock.t)
		}
	})

	t.Run("equal-min-max-latency-exact", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"latency": map[string]any{"min": 50, "max": 50},
			"sleep":   clock.sleep,
		}))
		h.op(fhOpSpec{op: "load"})
		if clock.t != 50 {
			t.Errorf("expected exactly 50ms, got %d", clock.t)
		}
	})

	t.Run("failTimes-returns-retryable-status", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"failTimes": 2, "failStatus": 503}))
		if res := h.op(fhOpSpec{op: "load"}); res.result.Status != 503 {
			t.Errorf("expected 503, got %d", res.result.Status)
		}
		if res := h.op(fhOpSpec{op: "load"}); res.result.Status != 503 {
			t.Errorf("expected 503, got %d", res.result.Status)
		}
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected third call to succeed, got err: %v", res.err)
		}
	})

	t.Run("failEvery-fails-every-nth", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"failEvery": 2}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("call 1 should succeed: %v", res.err)
		}
		if res := h.op(fhOpSpec{op: "load"}); res.ok {
			t.Error("call 2 should fail")
		}
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("call 3 should succeed: %v", res.err)
		}
	})

	t.Run("failRate-with-seed-deterministic", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"failRate": 1, "seed": 5}))
		if res := h.op(fhOpSpec{op: "load"}); res.ok {
			t.Error("expected deterministic failure")
		}
	})

	t.Run("errorTimes-connection-error", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"errorTimes": 1}))
		res := h.op(fhOpSpec{op: "load"})
		if fhErrCode(res.err) != "netsim_conn" {
			t.Errorf("expected netsim_conn, got %v", res.err)
		}
	})

	t.Run("offline-fails-every-call", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"offline": true}))
		res := h.op(fhOpSpec{op: "load"})
		if fhErrCode(res.err) != "netsim_offline" {
			t.Errorf("expected netsim_offline, got %v", res.err)
		}
	})

	t.Run("rateLimitTimes-429-retry-after", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"rateLimitTimes": 1, "retryAfter": 3}))
		res := h.op(fhOpSpec{op: "load"})
		if res.result.Status != 429 {
			t.Errorf("expected 429, got %d", res.result.Status)
		}
		if res.result.Headers["retry-after"] != "3" {
			t.Errorf("expected retry-after 3, got %v", res.result.Headers["retry-after"])
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		f := feat.NewNetsimFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false, "offline": true}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("inactive netsim must not simulate: %v", res.err)
		}
		if f.Calls != 0 {
			t.Errorf("expected 0 simulated calls, got %d", f.Calls)
		}
	})
}

// --- retry ------------------------------------------------------------------

func TestFeatureRetry(t *testing.T) {
	fhSkipWithout(t, "retry")

	t.Run("retries-transient-then-succeeds", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		clock := &fhClock{}
		rf := feat.NewRetryFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 2, "failStatus": 503}),
			fhF(rf, map[string]any{"retries": 3, "minDelay": 10, "jitter": false, "sleep": clock.sleep}),
		)
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Fatalf("expected success after retries: %v", res.err)
		}
		if rf.Attempts != 2 {
			t.Errorf("expected 2 retries, got %d", rf.Attempts)
		}
	})

	t.Run("gives-up-after-budget", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		clock := &fhClock{}
		rf := feat.NewRetryFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 9, "failStatus": 500}),
			fhF(rf, map[string]any{"retries": 2, "minDelay": 1, "jitter": false, "sleep": clock.sleep}),
		)
		res := h.op(fhOpSpec{op: "load"})
		if res.result.Status != 500 {
			t.Errorf("expected final 500, got %d", res.result.Status)
		}
	})

	t.Run("does-not-retry-non-retryable-status", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(404, nil, nil), nil
		}}
		h := fhMake(rec.fetch, fhF(feat.NewRetryFeature(), map[string]any{"retries": 3, "minDelay": 0}))
		h.op(fhOpSpec{op: "load"})
		if len(rec.calls) != 1 {
			t.Errorf("expected 1 call, got %d", len(rec.calls))
		}
	})

	t.Run("retries-transport-error-then-returns-it", func(t *testing.T) {
		clock := &fhClock{}
		n := 0
		server := func(ctx *sdk.Context, _ string, _ map[string]any) (any, error) {
			n++
			return nil, ctx.MakeError("boom", "boom")
		}
		h := fhMake(server, fhF(feat.NewRetryFeature(),
			map[string]any{"retries": 2, "minDelay": 1, "jitter": false, "sleep": clock.sleep}))
		res := h.op(fhOpSpec{op: "load"})
		if res.ok {
			t.Error("expected failure")
		}
		if n != 3 {
			t.Errorf("expected 3 attempts, got %d", n)
		}
	})

	t.Run("retries-nil-transport-result", func(t *testing.T) {
		n := 0
		server := func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			n++
			if n < 2 {
				return nil, nil
			}
			return fhResponse(200, map[string]any{"ok": true}, nil), nil
		}
		h := fhMake(server, fhF(feat.NewRetryFeature(), map[string]any{"retries": 3, "minDelay": 0}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected success, got %v", res.err)
		}
		if n != 2 {
			t.Errorf("expected 2 attempts, got %d", n)
		}
	})

	t.Run("honours-server-retry-after", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		clock := &fhClock{}
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"rateLimitTimes": 1, "retryAfter": 2}),
			fhF(feat.NewRetryFeature(), map[string]any{
				"retries": 2, "minDelay": 10, "maxDelay": 60000,
				"jitter": false, "sleep": clock.sleep,
			}),
		)
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Fatalf("expected success: %v", res.err)
		}
		if clock.t != 2000 {
			t.Errorf("expected 2000ms Retry-After wait, got %d", clock.t)
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(503, nil, nil), nil
		}}
		h := fhMake(rec.fetch, fhF(feat.NewRetryFeature(), map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if len(rec.calls) != 1 {
			t.Errorf("expected 1 call, got %d", len(rec.calls))
		}
	})
}

// --- timeout ----------------------------------------------------------------

func TestFeatureTimeout(t *testing.T) {
	fhSkipWithout(t, "timeout")

	t.Run("slow-request-times-out", func(t *testing.T) {
		server := func(_ *sdk.Context, _ string, _ map[string]any) (any, error) {
			time.Sleep(60 * time.Millisecond)
			return fhResponse(200, map[string]any{"ok": true}, nil), nil
		}
		f := feat.NewTimeoutFeature()
		h := fhMake(server, fhF(f, map[string]any{"ms": 10}))
		res := h.op(fhOpSpec{op: "load"})
		if fhErrCode(res.err) != "timeout" {
			t.Errorf("expected timeout error, got %v", res.err)
		}
		if f.Count != 1 {
			t.Errorf("expected 1 timeout, got %d", f.Count)
		}
	})

	t.Run("fast-request-passes", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewTimeoutFeature(), map[string]any{"ms": 1000}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected success: %v", res.err)
		}
	})

	t.Run("ms-zero-disables", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewTimeoutFeature(), map[string]any{"ms": 0}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected success: %v", res.err)
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewTimeoutFeature(), map[string]any{"active": false}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected success: %v", res.err)
		}
	})
}

// --- ratelimit ----------------------------------------------------------------

func TestFeatureRatelimit(t *testing.T) {
	fhSkipWithout(t, "ratelimit")

	t.Run("throttles-once-burst-spent", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewRatelimitFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"rate": 1, "burst": 2, "now": clock.now, "sleep": clock.sleep,
		}))
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "load"})
		if f.Throttled != 1 {
			t.Errorf("expected 1 throttle, got %d", f.Throttled)
		}
		if clock.t <= 0 {
			t.Error("expected the clock to advance while throttled")
		}
	})

	t.Run("burst-defaults-to-rate-and-refills", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewRatelimitFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"rate": 2, "now": clock.now, "sleep": clock.sleep,
		}))
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "load"})
		clock.advance(1000) // refill
		h.op(fhOpSpec{op: "load"})
		if f.Throttled != 0 {
			t.Errorf("expected no throttling after refill, got %d", f.Throttled)
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		f := feat.NewRatelimitFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected success: %v", res.err)
		}
		if f.Throttled != 0 {
			t.Errorf("expected no throttling, got %d", f.Throttled)
		}
	})
}

// --- cache --------------------------------------------------------------------

func TestFeatureCache(t *testing.T) {
	fhSkipWithout(t, "cache")

	t.Run("serves-repeated-read-from-cache", func(t *testing.T) {
		rec := &fhRecorder{}
		f := feat.NewCacheFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{"ttl": 10000}))
		a := h.op(fhOpSpec{op: "load", path: "/w/1"})
		b := h.op(fhOpSpec{op: "load", path: "/w/1"})
		if len(rec.calls) != 1 {
			t.Errorf("expected 1 network call, got %d", len(rec.calls))
		}
		if !reflect.DeepEqual(a.data, b.data) {
			t.Errorf("expected identical cached data: %v != %v", a.data, b.data)
		}
		if f.Hit != 1 {
			t.Errorf("expected 1 hit, got %d", f.Hit)
		}
	})

	t.Run("does-not-cache-non-get", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewCacheFeature(), nil))
		h.op(fhOpSpec{op: "create", path: "/w"})
		h.op(fhOpSpec{op: "create", path: "/w"})
		if len(rec.calls) != 2 {
			t.Errorf("expected 2 calls, got %d", len(rec.calls))
		}
	})

	t.Run("does-not-cache-non-2xx", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(500, nil, nil), nil
		}}
		f := feat.NewCacheFeature()
		h := fhMake(rec.fetch, fhF(f, nil))
		h.op(fhOpSpec{op: "load", path: "/w"})
		h.op(fhOpSpec{op: "load", path: "/w"})
		if len(rec.calls) != 2 {
			t.Errorf("expected 2 calls, got %d", len(rec.calls))
		}
		if f.Bypass != 2 {
			t.Errorf("expected 2 bypasses, got %d", f.Bypass)
		}
	})

	t.Run("refetches-after-ttl", func(t *testing.T) {
		clock := &fhClock{}
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewCacheFeature(),
			map[string]any{"ttl": 1000, "now": clock.now}))
		h.op(fhOpSpec{op: "load", path: "/w"})
		clock.advance(1500)
		h.op(fhOpSpec{op: "load", path: "/w"})
		if len(rec.calls) != 2 {
			t.Errorf("expected 2 calls after ttl expiry, got %d", len(rec.calls))
		}
	})

	t.Run("evicts-oldest-past-max", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewCacheFeature(),
			map[string]any{"ttl": 10000, "max": 1}))
		h.op(fhOpSpec{op: "load", path: "/a"})
		h.op(fhOpSpec{op: "load", path: "/b"}) // evicts /a
		h.op(fhOpSpec{op: "load", path: "/a"}) // miss again
		if len(rec.calls) != 3 {
			t.Errorf("expected 3 calls, got %d", len(rec.calls))
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewCacheFeature(), map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load", path: "/x"})
		h.op(fhOpSpec{op: "load", path: "/x"})
		if len(rec.calls) != 2 {
			t.Errorf("expected 2 calls, got %d", len(rec.calls))
		}
	})
}

// --- idempotency ----------------------------------------------------------------

func TestFeatureIdempotency(t *testing.T) {
	fhSkipWithout(t, "idempotency")

	t.Run("adds-key-to-mutating-ops", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewIdempotencyFeature(), nil))
		h.op(fhOpSpec{op: "create", path: "/w"})
		if rec.headers(0)["Idempotency-Key"] == nil {
			t.Error("expected Idempotency-Key header on create")
		}
	})

	t.Run("adds-key-by-http-method", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewIdempotencyFeature(), nil))
		h.op(fhOpSpec{op: "act", method: "PUT", path: "/w"})
		if rec.headers(0)["Idempotency-Key"] == nil {
			t.Error("expected Idempotency-Key header on PUT")
		}
	})

	t.Run("leaves-reads-untouched", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewIdempotencyFeature(), nil))
		h.op(fhOpSpec{op: "load", path: "/w/1"})
		if rec.headers(0)["Idempotency-Key"] != nil {
			t.Error("expected no Idempotency-Key header on load")
		}
	})

	t.Run("preserves-caller-key-custom-header", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewIdempotencyFeature(),
			map[string]any{"header": "X-Idem"}))
		h.op(fhOpSpec{op: "create", path: "/w", headers: map[string]any{"X-Idem": "caller-1"}})
		if rec.headers(0)["X-Idem"] != "caller-1" {
			t.Errorf("expected caller key preserved, got %v", rec.headers(0)["X-Idem"])
		}
	})

	t.Run("injected-keygen", func(t *testing.T) {
		rec := &fhRecorder{}
		f := feat.NewIdempotencyFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{
			"keygen": (func() string)(func() string { return "K1" }),
		}))
		h.op(fhOpSpec{op: "create", path: "/w"})
		if rec.headers(0)["Idempotency-Key"] != "K1" {
			t.Errorf("expected injected key, got %v", rec.headers(0)["Idempotency-Key"])
		}
		if f.Last != "K1" || f.Issued != 1 {
			t.Errorf("expected tracking issued=1 last=K1, got %d %q", f.Issued, f.Last)
		}
	})

	t.Run("inactive-is-noop", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewIdempotencyFeature(), map[string]any{"active": false}))
		h.op(fhOpSpec{op: "create", path: "/w"})
		if rec.headers(0)["Idempotency-Key"] != nil {
			t.Error("inactive idempotency must not add a key")
		}
	})
}

// --- rbac -----------------------------------------------------------------------

func TestFeatureRbac(t *testing.T) {
	fhSkipWithout(t, "rbac")

	t.Run("denies-before-any-call", func(t *testing.T) {
		rec := &fhRecorder{}
		f := feat.NewRbacFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{
			"rules":       map[string]any{"widget.remove": "admin"},
			"permissions": []any{},
		}))
		res := h.op(fhOpSpec{op: "remove", path: "/w/1"})
		if fhErrCode(res.err) != "rbac_denied" {
			t.Errorf("expected rbac_denied, got %v", res.err)
		}
		if len(rec.calls) != 0 {
			t.Errorf("expected no network calls, got %d", len(rec.calls))
		}
		if f.Denied != 1 {
			t.Errorf("expected 1 denial, got %d", f.Denied)
		}
	})

	t.Run("allows-held-permission", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewRbacFeature(), map[string]any{
			"rules":       map[string]any{"widget.remove": "admin"},
			"permissions": []any{"admin"},
		}))
		if res := h.op(fhOpSpec{op: "remove", path: "/w/1"}); !res.ok {
			t.Errorf("expected allow: %v", res.err)
		}
	})

	t.Run("op-rule-and-wildcard-grant", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewRbacFeature(), map[string]any{
			"rules":       map[string]any{"load": "read"},
			"permissions": []any{"*"},
		}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected wildcard grant: %v", res.err)
		}
	})

	t.Run("default-allow-and-deny-true", func(t *testing.T) {
		allow := fhMake(nil, fhF(feat.NewRbacFeature(), map[string]any{
			"permissions": []any{},
		}))
		if res := allow.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("expected default allow: %v", res.err)
		}
		deny := fhMake(nil, fhF(feat.NewRbacFeature(), map[string]any{
			"deny":        true,
			"permissions": []any{},
		}))
		if res := deny.op(fhOpSpec{op: "load"}); fhErrCode(res.err) != "rbac_denied" {
			t.Errorf("expected default deny, got %v", res.err)
		}
	})

	t.Run("inactive-is-noop", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewRbacFeature(), map[string]any{
			"active": false,
			"deny":   true,
		}))
		if res := h.op(fhOpSpec{op: "load"}); !res.ok {
			t.Errorf("inactive rbac must not deny: %v", res.err)
		}
	})
}

// --- metrics --------------------------------------------------------------------

func TestFeatureMetrics(t *testing.T) {
	fhSkipWithout(t, "metrics")

	t.Run("counts-ok-and-err-per-op", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		f := feat.NewMetricsFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 1, "failStatus": 500}),
			fhF(f, nil),
		)
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "list"})
		if f.Total.Count != 3 || f.Total.Ok != 2 || f.Total.Err != 1 {
			t.Errorf("expected total 3/2/1, got %d/%d/%d",
				f.Total.Count, f.Total.Ok, f.Total.Err)
		}
		if f.Ops["widget.load"] == nil || f.Ops["widget.load"].Count != 2 {
			t.Errorf("expected widget.load count 2, got %+v", f.Ops["widget.load"])
		}
	})

	t.Run("injected-clock", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewMetricsFeature()
		h := fhMake(nil, fhF(f, map[string]any{"now": clock.now}))
		h.op(fhOpSpec{op: "load"})
		if f.Total.Count != 1 {
			t.Errorf("expected 1 recorded op, got %d", f.Total.Count)
		}
		if f.Total.TotalMs != 0 {
			t.Errorf("expected 0ms with frozen clock, got %d", f.Total.TotalMs)
		}
	})

	t.Run("inactive-records-nothing", func(t *testing.T) {
		f := feat.NewMetricsFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if f.Total.Count != 0 {
			t.Errorf("expected no records, got %d", f.Total.Count)
		}
	})
}

// --- telemetry ------------------------------------------------------------------

func TestFeatureTelemetry(t *testing.T) {
	fhSkipWithout(t, "telemetry")

	t.Run("opens-spans-and-propagates-headers", func(t *testing.T) {
		rec := &fhRecorder{}
		var exported []map[string]any
		f := feat.NewTelemetryFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{
			"exporter": (func(map[string]any))(func(s map[string]any) {
				exported = append(exported, s)
			}),
		}))
		res := h.op(fhOpSpec{op: "load"})
		if !res.ok {
			t.Fatalf("expected success: %v", res.err)
		}
		if len(f.Spans) != 1 || len(exported) != 1 {
			t.Fatalf("expected 1 span + 1 export, got %d/%d", len(f.Spans), len(exported))
		}
		sent := rec.headers(0)
		if sent["X-Trace-Id"] != f.Spans[0]["traceId"] {
			t.Errorf("expected propagated trace id, got %v", sent["X-Trace-Id"])
		}
		traceparent, _ := sent["traceparent"].(string)
		if !regexp.MustCompile(`^00-.+-.+-01$`).MatchString(traceparent) {
			t.Errorf("expected W3C traceparent, got %q", traceparent)
		}
	})

	t.Run("records-failed-span", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		f := feat.NewTelemetryFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 1, "failStatus": 500}),
			fhF(f, nil),
		)
		h.op(fhOpSpec{op: "load"})
		if len(f.Spans) != 1 || f.Spans[0]["ok"] != false {
			t.Errorf("expected 1 failed span, got %+v", f.Spans)
		}
	})

	t.Run("injected-idgen-and-clock", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewTelemetryFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"idgen": (func(string) string)(func(kind string) string { return kind + "-X" }),
			"now":   clock.now,
		}))
		h.op(fhOpSpec{op: "load"})
		if f.Spans[0]["traceId"] != "trace-X" {
			t.Errorf("expected injected trace id, got %v", f.Spans[0]["traceId"])
		}
		if f.Spans[0]["durationMs"] != int64(0) {
			t.Errorf("expected 0ms span with frozen clock, got %v", f.Spans[0]["durationMs"])
		}
	})

	t.Run("inactive-records-nothing", func(t *testing.T) {
		f := feat.NewTelemetryFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if len(f.Spans) != 0 {
			t.Errorf("expected no spans, got %d", len(f.Spans))
		}
	})
}

// --- debug ----------------------------------------------------------------------

func TestFeatureDebug(t *testing.T) {
	fhSkipWithout(t, "debug")

	t.Run("redacts-and-honours-onentry-max", func(t *testing.T) {
		var seen []map[string]any
		f := feat.NewDebugFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"max": 1,
			"onEntry": (func(map[string]any))(func(e map[string]any) {
				seen = append(seen, e)
			}),
		}))
		h.op(fhOpSpec{op: "load", headers: map[string]any{"authorization": "Bearer secret"}})
		h.op(fhOpSpec{op: "list"})
		if len(f.Entries) != 1 {
			t.Errorf("expected ring buffer capped at 1, got %d", len(f.Entries))
		}
		if len(seen) != 2 {
			t.Errorf("expected onEntry for both ops, got %d", len(seen))
		}
		headers, _ := seen[0]["headers"].(map[string]any)
		if headers["authorization"] != "<redacted>" {
			t.Errorf("expected redacted authorization, got %v", headers["authorization"])
		}
	})

	t.Run("captures-failures", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		f := feat.NewDebugFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 1, "failStatus": 500}),
			fhF(f, nil),
		)
		h.op(fhOpSpec{op: "load"})
		if len(f.Entries) != 1 || f.Entries[0]["ok"] != false {
			t.Errorf("expected 1 failed entry, got %+v", f.Entries)
		}
	})

	t.Run("injected-clock-and-custom-redact", func(t *testing.T) {
		clock := &fhClock{}
		f := feat.NewDebugFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"now":    clock.now,
			"redact": []any{"x-secret"},
		}))
		h.op(fhOpSpec{op: "load", headers: map[string]any{"x-secret": "hide", "x-ok": "show"}})
		headers, _ := f.Entries[0]["headers"].(map[string]any)
		if headers["x-secret"] != "<redacted>" {
			t.Errorf("expected x-secret redacted, got %v", headers["x-secret"])
		}
		if headers["x-ok"] != "show" {
			t.Errorf("expected x-ok kept, got %v", headers["x-ok"])
		}
	})

	t.Run("inactive-records-nothing", func(t *testing.T) {
		f := feat.NewDebugFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if len(f.Entries) != 0 {
			t.Errorf("expected no entries, got %d", len(f.Entries))
		}
	})
}

// --- audit ----------------------------------------------------------------------

func TestFeatureAudit(t *testing.T) {
	fhSkipWithout(t, "audit")

	t.Run("one-record-per-op-sink-actor", func(t *testing.T) {
		fhSkipWithout(t, "netsim")
		var sunk []map[string]any
		f := feat.NewAuditFeature()
		h := fhMake(nil,
			fhF(feat.NewNetsimFeature(), map[string]any{"failTimes": 1, "failStatus": 500}),
			fhF(f, map[string]any{
				"actor": "svc",
				"max":   5,
				"sink": (func(map[string]any))(func(r map[string]any) {
					sunk = append(sunk, r)
				}),
			}),
		)
		h.op(fhOpSpec{op: "remove", path: "/w/1"})
		h.op(fhOpSpec{op: "load", ctrl: map[string]any{"actor": "per-call"}})
		if len(f.Records) != 2 {
			t.Fatalf("expected 2 records, got %d", len(f.Records))
		}
		if f.Records[0]["outcome"] != "error" {
			t.Errorf("expected error outcome, got %v", f.Records[0]["outcome"])
		}
		if f.Records[0]["actor"] != "svc" {
			t.Errorf("expected svc actor, got %v", f.Records[0]["actor"])
		}
		if f.Records[1]["actor"] != "per-call" {
			t.Errorf("expected per-call actor, got %v", f.Records[1]["actor"])
		}
		if len(sunk) != 2 {
			t.Errorf("expected 2 sunk records, got %d", len(sunk))
		}
	})

	t.Run("default-actor-anonymous", func(t *testing.T) {
		f := feat.NewAuditFeature()
		h := fhMake(nil, fhF(f, nil))
		h.op(fhOpSpec{op: "load"})
		if f.Records[0]["actor"] != "anonymous" {
			t.Errorf("expected anonymous actor, got %v", f.Records[0]["actor"])
		}
	})

	t.Run("injected-clock", func(t *testing.T) {
		f := feat.NewAuditFeature()
		h := fhMake(nil, fhF(f, map[string]any{
			"now": (func() int64)(func() int64 { return 42 }),
		}))
		h.op(fhOpSpec{op: "load"})
		if f.Records[0]["ts"] != int64(42) {
			t.Errorf("expected ts 42, got %v", f.Records[0]["ts"])
		}
	})

	t.Run("inactive-records-nothing", func(t *testing.T) {
		f := feat.NewAuditFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if len(f.Records) != 0 {
			t.Errorf("expected no records, got %d", len(f.Records))
		}
	})
}

// --- clienttrack ----------------------------------------------------------------

func TestFeatureClienttrack(t *testing.T) {
	fhSkipWithout(t, "clienttrack")

	t.Run("stable-client-id-unique-request-ids-ua", func(t *testing.T) {
		rec := &fhRecorder{}
		f := feat.NewClienttrackFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{
			"clientName": "Acme", "clientVersion": "2.0.0",
		}))
		h.op(fhOpSpec{op: "load"})
		h.op(fhOpSpec{op: "load"})
		h0 := rec.headers(0)
		h1 := rec.headers(1)
		if h0["User-Agent"] != "Acme/2.0.0" {
			t.Errorf("expected Acme/2.0.0 UA, got %v", h0["User-Agent"])
		}
		if h0["X-Client-Id"] != h1["X-Client-Id"] {
			t.Errorf("expected stable client id: %v != %v", h0["X-Client-Id"], h1["X-Client-Id"])
		}
		if h0["X-Request-Id"] == h1["X-Request-Id"] {
			t.Errorf("expected fresh request ids, both %v", h0["X-Request-Id"])
		}
		if f.Requests != 2 {
			t.Errorf("expected 2 tracked requests, got %d", f.Requests)
		}
	})

	t.Run("does-not-clobber-caller-ua", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewClienttrackFeature(), nil))
		h.op(fhOpSpec{op: "load", headers: map[string]any{"User-Agent": "mine"}})
		if rec.headers(0)["User-Agent"] != "mine" {
			t.Errorf("expected caller UA preserved, got %v", rec.headers(0)["User-Agent"])
		}
	})

	t.Run("injected-idgen-fixed-session", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewClienttrackFeature(), map[string]any{
			"sessionId": "S1",
			"idgen":     (func(string) string)(func(kind string) string { return kind + "-1" }),
		}))
		h.op(fhOpSpec{op: "load"})
		if rec.headers(0)["X-Client-Id"] != "S1" {
			t.Errorf("expected fixed session, got %v", rec.headers(0)["X-Client-Id"])
		}
		if rec.headers(0)["X-Request-Id"] != "request-1" {
			t.Errorf("expected injected request id, got %v", rec.headers(0)["X-Request-Id"])
		}
	})

	t.Run("inactive-stamps-nothing", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewClienttrackFeature(), map[string]any{"active": false}))
		h.op(fhOpSpec{op: "load"})
		if rec.headers(0)["X-Client-Id"] != nil {
			t.Error("inactive clienttrack must not stamp headers")
		}
	})
}

// --- paging ---------------------------------------------------------------------

func TestFeaturePaging(t *testing.T) {
	fhSkipWithout(t, "paging")

	t.Run("stamps-page-limit-and-reads-headers", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(200, map[string]any{"items": []any{1, 2}}, map[string]any{
				"x-next-page":   "2",
				"x-total-count": "5",
				"link":          `</w?page=2>; rel="next"`,
			}), nil
		}}
		f := feat.NewPagingFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{"limit": 2}))
		res := h.op(fhOpSpec{op: "list", path: "/w"})
		if !strings.Contains(rec.url(0), "page=1") {
			t.Errorf("expected page=1 stamped, got %s", rec.url(0))
		}
		if !strings.Contains(rec.url(0), "limit=2") {
			t.Errorf("expected limit=2 stamped, got %s", rec.url(0))
		}
		paging := res.result.Paging
		if paging["nextPage"] != 2 {
			t.Errorf("expected nextPage 2, got %v", paging["nextPage"])
		}
		if paging["totalCount"] != 5 {
			t.Errorf("expected totalCount 5, got %v", paging["totalCount"])
		}
		if paging["next"] != "/w?page=2" {
			t.Errorf("expected link next, got %v", paging["next"])
		}
	})

	t.Run("body-cursor-and-explicit-cursor", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(200, map[string]any{"nextCursor": "abc", "hasMore": true}, nil), nil
		}}
		h := fhMake(rec.fetch, fhF(feat.NewPagingFeature(), nil))
		res := h.op(fhOpSpec{
			op:   "list",
			path: "/w",
			ctrl: map[string]any{"paging": map[string]any{"cursor": "xyz"}},
		})
		if !strings.Contains(rec.url(0), "cursor=xyz") {
			t.Errorf("expected cursor=xyz stamped, got %s", rec.url(0))
		}
		if res.result.Paging["cursor"] != "abc" {
			t.Errorf("expected body cursor, got %v", res.result.Paging["cursor"])
		}
		if res.result.Paging["hasMore"] != true {
			t.Errorf("expected hasMore, got %v", res.result.Paging["hasMore"])
		}
	})

	t.Run("non-list-not-paged", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewPagingFeature(), nil))
		h.op(fhOpSpec{op: "load", path: "/w/1"})
		if strings.Contains(rec.url(0), "page=") {
			t.Errorf("expected no page param, got %s", rec.url(0))
		}
	})

	t.Run("inactive-stamps-nothing", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewPagingFeature(), map[string]any{"active": false}))
		h.op(fhOpSpec{op: "list", path: "/w"})
		if strings.Contains(rec.url(0), "page=") {
			t.Errorf("inactive paging must not stamp, got %s", rec.url(0))
		}
	})
}

// --- streaming ------------------------------------------------------------------

func TestFeatureStreaming(t *testing.T) {
	fhSkipWithout(t, "streaming")

	t.Run("streams-list-items", func(t *testing.T) {
		clock := &fhClock{}
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(200, []any{"a", "b", "c"}, nil), nil
		}}
		h := fhMake(rec.fetch, fhF(feat.NewStreamingFeature(),
			map[string]any{"chunkDelay": 5, "sleep": clock.sleep}))
		res := h.op(fhOpSpec{op: "list", path: "/w"})
		if !res.result.Streaming {
			t.Fatal("expected streaming result")
		}
		var seen []any
		for item := range res.result.Stream() {
			seen = append(seen, item)
		}
		if !reflect.DeepEqual(seen, []any{"a", "b", "c"}) {
			t.Errorf("expected streamed items, got %v", seen)
		}
		if clock.t != 15 {
			t.Errorf("expected 15ms paced delay, got %d", clock.t)
		}
	})

	t.Run("batches-with-chunksize", func(t *testing.T) {
		rec := &fhRecorder{reply: func(_ int, _ map[string]any) (any, error) {
			return fhResponse(200, []any{1, 2, 3, 4, 5}, nil), nil
		}}
		h := fhMake(rec.fetch, fhF(feat.NewStreamingFeature(), map[string]any{"chunkSize": 2}))
		res := h.op(fhOpSpec{op: "list", path: "/w"})
		var batches [][]any
		for b := range res.result.Stream() {
			batch, _ := b.([]any)
			batches = append(batches, batch)
		}
		want := [][]any{{1, 2}, {3, 4}, {5}}
		if !reflect.DeepEqual(batches, want) {
			t.Errorf("expected %v, got %v", want, batches)
		}
	})

	t.Run("non-list-not-streamed", func(t *testing.T) {
		h := fhMake(nil, fhF(feat.NewStreamingFeature(), nil))
		res := h.op(fhOpSpec{op: "load"})
		if res.result.Streaming || res.result.Stream != nil {
			t.Error("expected no stream on a non-list op")
		}
	})

	t.Run("inactive-is-noop", func(t *testing.T) {
		f := feat.NewStreamingFeature()
		h := fhMake(nil, fhF(f, map[string]any{"active": false}))
		res := h.op(fhOpSpec{op: "list", path: "/w"})
		if res.result.Streaming {
			t.Error("inactive streaming must not attach")
		}
		if f.Opened != 0 {
			t.Errorf("expected no opened streams, got %d", f.Opened)
		}
	})
}

// --- proxy ----------------------------------------------------------------------

func TestFeatureProxy(t *testing.T) {
	fhSkipWithout(t, "proxy")

	t.Run("routes-through-proxy", func(t *testing.T) {
		rec := &fhRecorder{}
		f := feat.NewProxyFeature()
		h := fhMake(rec.fetch, fhF(f, map[string]any{"url": "http://proxy:8080"}))
		h.op(fhOpSpec{op: "load"})
		if rec.fetchdef(0)["proxy"] != "http://proxy:8080" {
			t.Errorf("expected proxy annotation, got %v", rec.fetchdef(0)["proxy"])
		}
		if f.Routed != 1 {
			t.Errorf("expected 1 routed call, got %d", f.Routed)
		}
	})

	t.Run("bypasses-noproxy-hosts", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewProxyFeature(), map[string]any{
			"url":     "http://proxy:8080",
			"noProxy": []any{"api.test"},
		}))
		h.op(fhOpSpec{op: "load"})
		if rec.fetchdef(0)["proxy"] != nil {
			t.Errorf("expected noProxy bypass, got %v", rec.fetchdef(0)["proxy"])
		}
	})

	t.Run("fromenv-reads-https-proxy", func(t *testing.T) {
		prev, had := os.LookupEnv("HTTPS_PROXY")
		os.Setenv("HTTPS_PROXY", "http://env-proxy:8080")
		defer func() {
			if had {
				os.Setenv("HTTPS_PROXY", prev)
			} else {
				os.Unsetenv("HTTPS_PROXY")
			}
		}()
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewProxyFeature(), map[string]any{"fromEnv": true}))
		h.op(fhOpSpec{op: "load"})
		if rec.fetchdef(0)["proxy"] != "http://env-proxy:8080" {
			t.Errorf("expected env proxy, got %v", rec.fetchdef(0)["proxy"])
		}
	})

	t.Run("no-url-is-noop", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewProxyFeature(), nil))
		h.op(fhOpSpec{op: "load"})
		if rec.fetchdef(0)["proxy"] != nil {
			t.Errorf("expected no proxy annotation, got %v", rec.fetchdef(0)["proxy"])
		}
	})

	t.Run("inactive-does-not-wrap", func(t *testing.T) {
		rec := &fhRecorder{}
		h := fhMake(rec.fetch, fhF(feat.NewProxyFeature(), map[string]any{
			"active": false, "url": "http://proxy:8080",
		}))
		h.op(fhOpSpec{op: "load"})
		if rec.fetchdef(0)["proxy"] != nil {
			t.Errorf("inactive proxy must not route, got %v", rec.fetchdef(0)["proxy"])
		}
	})
}

// --- composition ----------------------------------------------------------------

func TestFeatureComposition(t *testing.T) {
	fhSkipWithout(t, "cache", "netsim")

	t.Run("cache-hit-skips-simulated-failure", func(t *testing.T) {
		nf := feat.NewNetsimFeature()
		h := fhMake(nil,
			fhF(nf, map[string]any{"failEvery": 2}),
			fhF(feat.NewCacheFeature(), map[string]any{"ttl": 10000}),
		)
		if res := h.op(fhOpSpec{op: "load", path: "/w"}); !res.ok {
			t.Fatalf("first load should succeed: %v", res.err)
		}
		if res := h.op(fhOpSpec{op: "load", path: "/w"}); !res.ok {
			t.Fatalf("second load should hit the cache: %v", res.err)
		}
		if nf.Calls != 1 {
			t.Errorf("expected 1 simulated call, got %d", nf.Calls)
		}
	})
}
