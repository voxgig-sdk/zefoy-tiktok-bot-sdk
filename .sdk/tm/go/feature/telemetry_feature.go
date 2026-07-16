package feature

import (
	"fmt"

	"GOMODULE/core"
)

// Distributed-tracing telemetry. Opens a span per operation (PrePoint),
// propagates trace context to the server as W3C `traceparent` plus
// `X-Trace-Id` / `X-Span-Id` headers (PreRequest), and closes the span on
// completion (PreDone) or failure (PreUnexpected). Each span closes exactly
// once (the per-context marker in ctx.Out is consumed on close). Finished
// spans accumulate on the feature; an `exporter` callback, when provided,
// is invoked with each finished span. Trace/span id generation (`idgen`)
// and the clock (`now`) are injectable for deterministic tests.
type TelemetryFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	seq     int

	// Activity tracking (mirrors the ts client._telemetry record).
	Spans       []map[string]any
	ActiveSpans int
}

const telemetrySpanKey = "telemetry_span"

func NewTelemetryFeature() *TelemetryFeature {
	return &TelemetryFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "telemetry",
			Active:  true,
		},
	}
}

func (f *TelemetryFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
	f.seq = 0
}

func (f *TelemetryFeature) PrePoint(ctx *core.Context) {
	if !f.Active {
		return
	}

	entity := "_"
	opname := "_"
	if ctx.Op != nil {
		entity = ctx.Op.Entity
		opname = ctx.Op.Name
	}

	span := map[string]any{
		"traceId": f.id("trace"),
		"spanId":  f.id("span"),
		"name":    entity + "." + opname,
		"start":   foptNow(f.options)(),
	}
	ctx.Out[telemetrySpanKey] = span
	f.ActiveSpans++
}

func (f *TelemetryFeature) PreRequest(ctx *core.Context) {
	if !f.Active {
		return
	}

	span, has := ctx.Out[telemetrySpanKey].(map[string]any)
	spec := ctx.Spec
	if !has || spec == nil {
		return
	}
	if spec.Headers == nil {
		spec.Headers = map[string]any{}
	}

	h := foptMap(f.options, "headers")
	traceId, _ := span["traceId"].(string)
	spanId, _ := span["spanId"].(string)
	spec.Headers[foptStr(h, "trace", "X-Trace-Id")] = traceId
	spec.Headers[foptStr(h, "span", "X-Span-Id")] = spanId
	spec.Headers[foptStr(h, "parent", "traceparent")] =
		"00-" + traceId + "-" + spanId + "-01"
}

func (f *TelemetryFeature) PreDone(ctx *core.Context) {
	f.close(ctx, ctx.Result != nil && ctx.Result.Ok && ctx.Result.Err == nil)
}

func (f *TelemetryFeature) PreUnexpected(ctx *core.Context) {
	f.close(ctx, false)
}

func (f *TelemetryFeature) close(ctx *core.Context, ok bool) {
	// Close once per operation; a PreDone followed by a pipeline failure
	// (non-2xx) fires PreUnexpected too, which then finds no open span.
	span, has := ctx.Out[telemetrySpanKey].(map[string]any)
	if !has {
		return
	}
	delete(ctx.Out, telemetrySpanKey)

	end := foptNow(f.options)()
	start, _ := span["start"].(int64)
	dur := end - start
	if dur < 0 {
		dur = 0
	}
	span["end"] = end
	span["durationMs"] = dur
	span["ok"] = ok

	f.ActiveSpans--
	f.Spans = append(f.Spans, span)

	if exporter, ok := f.options["exporter"].(func(map[string]any)); ok {
		exporter(span)
	}
}

func (f *TelemetryFeature) id(kind string) string {
	if idgen, ok := f.options["idgen"].(func(string) string); ok {
		return idgen(kind)
	}
	// Deterministic-ish sequential id; unique within a client instance.
	f.seq++
	n := fmt.Sprintf("%04x", f.seq)
	prefix := "s"
	if kind == "trace" {
		prefix = "t"
	}
	for len(n) < 16 {
		n += "0"
	}
	return prefix + n
}
