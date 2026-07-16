package feature

import (
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

// Statistics capture. Records per-operation counters and latency for every
// call: totals plus a breakdown keyed by `<entity>.<op>`. Timing starts at
// endpoint resolution (PrePoint) and stops when the call returns (PreDone)
// or fails (PreUnexpected); each operation is recorded exactly once (the
// per-context start marker in ctx.Out is consumed on record). The clock is
// injectable (`now`) for deterministic tests.
type MetricsFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Aggregates (mirrors the ts client._metrics record).
	Total *MetricsBucket
	Ops   map[string]*MetricsBucket
}

type MetricsBucket struct {
	Count   int
	Ok      int
	Err     int
	TotalMs int64
	MaxMs   int64
}

const metricsStartKey = "metrics_start"

func NewMetricsFeature() *MetricsFeature {
	return &MetricsFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "metrics",
			Active:  true,
		},
	}
}

func (f *MetricsFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	f.Total = &MetricsBucket{}
	f.Ops = map[string]*MetricsBucket{}
}

func (f *MetricsFeature) PrePoint(ctx *core.Context) {
	if !f.Active {
		return
	}
	ctx.Out[metricsStartKey] = foptNow(f.options)()
}

func (f *MetricsFeature) PreDone(ctx *core.Context) {
	// Classify by the actual result: a 4xx/5xx that flows through still
	// reaches PreDone before the pipeline errors.
	f.record(ctx, ctx.Result != nil && ctx.Result.Ok && ctx.Result.Err == nil)
}

func (f *MetricsFeature) PreUnexpected(ctx *core.Context) {
	f.record(ctx, false)
}

func (f *MetricsFeature) record(ctx *core.Context, ok bool) {
	// Record once per operation: the missing start marker makes a second
	// call (PreDone followed by PreUnexpected on failure) a no-op.
	start, has := ctx.Out[metricsStartKey].(int64)
	if !has {
		return
	}
	delete(ctx.Out, metricsStartKey)

	dur := foptNow(f.options)() - start
	if dur < 0 {
		dur = 0
	}

	entity := "_"
	opname := "_"
	if ctx.Op != nil {
		entity = ctx.Op.Entity
		opname = ctx.Op.Name
	}
	key := entity + "." + opname

	op := f.Ops[key]
	if op == nil {
		op = &MetricsBucket{}
		f.Ops[key] = op
	}

	f.bump(f.Total, ok, dur)
	f.bump(op, ok, dur)
}

func (f *MetricsFeature) bump(bucket *MetricsBucket, ok bool, dur int64) {
	bucket.Count++
	if ok {
		bucket.Ok++
	} else {
		bucket.Err++
	}
	bucket.TotalMs += dur
	if dur > bucket.MaxMs {
		bucket.MaxMs = dur
	}
}
