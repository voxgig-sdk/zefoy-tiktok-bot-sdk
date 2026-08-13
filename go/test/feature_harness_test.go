package sdktest

// Offline feature-test harness: a faithful miniature of the real operation
// pipeline (same hook order and short-circuit rules as the generated
// Entity*Op code) driven against a configurable mock transport, with no
// live server and no API-specific fixtures.
//
// SEPARATE FROM feature_test.go ON PURPOSE. `target add` drops the
// cross-feature suite when a project trims its feature set (it constructs
// every shipped feature by name), but pipeline_test.go and friends use
// these fh* helpers too — leaving them in feature_test.go took the whole
// test package down with it.

import (
	"fmt"
	neturl "net/url"
	"sort"
	"strings"
	"testing"

	sdk "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go"
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
