package feature

import (
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

// Audit trail. Emits a structured record for every operation — who (actor),
// what (entity + op), the outcome, and a correlation id — suitable for
// compliance logging. Records accumulate on the feature (bounded by `max`,
// default 1000) and, when a `sink` callback is supplied, are also pushed to
// it (e.g. to forward to a SIEM). The actor is the per-call ctrl actor,
// falling back to the options `actor`, then "anonymous". Each operation is
// audited exactly once (the per-context marker in ctx.Out prevents a
// PreDone + PreUnexpected double-log). Timestamps use the injectable `now`
// clock so tests stay deterministic.
type AuditFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	seq     int

	// Activity tracking (mirrors the ts client._audit record).
	Records []map[string]any
}

const auditSeenKey = "audit_seen"

func NewAuditFeature() *AuditFeature {
	return &AuditFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "audit",
			Active:  true,
		},
	}
}

func (f *AuditFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
	f.seq = 0
}

func (f *AuditFeature) PreDone(ctx *core.Context) {
	// Outcome reflects the actual result; a non-2xx reaches PreDone before
	// the pipeline errors.
	outcome := "error"
	if ctx.Result != nil && ctx.Result.Ok && ctx.Result.Err == nil {
		outcome = "ok"
	}
	f.emit(ctx, outcome)
}

func (f *AuditFeature) PreUnexpected(ctx *core.Context) {
	f.emit(ctx, "error")
}

func (f *AuditFeature) emit(ctx *core.Context, outcome string) {
	if !f.Active {
		return
	}

	// One record per operation (PreDone + a following PreUnexpected on a
	// failure must not double-log).
	if ctx.Out[auditSeenKey] == true {
		return
	}
	ctx.Out[auditSeenKey] = true

	f.seq++

	actor := "anonymous"
	if a := foptStr(f.options, "actor", ""); a != "" {
		actor = a
	}
	if ctx.Ctrl != nil && ctx.Ctrl.Actor != "" {
		actor = ctx.Ctrl.Actor
	}

	entity := "_"
	opname := "_"
	if ctx.Op != nil {
		entity = ctx.Op.Entity
		opname = ctx.Op.Name
	}

	record := map[string]any{
		"seq":           f.seq,
		"ts":            foptNow(f.options)(),
		"actor":         actor,
		"entity":        entity,
		"op":            opname,
		"outcome":       outcome,
		"correlationId": ctx.Id,
	}
	if ctx.Result != nil {
		record["status"] = ctx.Result.Status
	}

	f.Records = append(f.Records, record)
	max := foptInt(f.options, "max", 1000)
	for len(f.Records) > max {
		f.Records = f.Records[1:]
	}

	if sink, ok := f.options["sink"].(func(map[string]any)); ok {
		sink(record)
	}
}
