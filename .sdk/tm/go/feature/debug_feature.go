package feature

import (
	"strings"

	"GOMODULE/core"
)

// Request/response capture for debugging. Records a bounded ring buffer of
// per-operation traces — method, URL, redacted headers, response status and
// timing — on the feature's Entries. Sensitive header values (matching
// `redact`, default authorization/cookie/api-key style names) are masked.
// An optional `onEntry` callback receives each finished entry (e.g. to
// stream to a console). `max` caps the buffer (default 100).
type DebugFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._debug record).
	Entries []map[string]any
}

const debugEntryKey = "debug_entry"

var debugDefaultRedact = []string{
	"authorization", "cookie", "set-cookie", "api-key", "apikey",
	"x-api-key", "idempotency-key",
}

func NewDebugFeature() *DebugFeature {
	return &DebugFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "debug",
			Active:  true,
		},
	}
}

func (f *DebugFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
}

func (f *DebugFeature) PreRequest(ctx *core.Context) {
	if !f.Active {
		return
	}

	entity := "_"
	opname := "_"
	if ctx.Op != nil {
		entity = ctx.Op.Entity
		opname = ctx.Op.Name
	}

	entry := map[string]any{
		"op":    entity + "." + opname,
		"start": foptNow(f.options)(),
	}
	if ctx.Spec != nil {
		entry["method"] = ctx.Spec.Method
		if ctx.Spec.Url != "" {
			entry["url"] = ctx.Spec.Url
		} else {
			entry["url"] = ctx.Spec.Path
		}
		entry["headers"] = f.redact(ctx.Spec.Headers)
	}
	ctx.Out[debugEntryKey] = entry
}

func (f *DebugFeature) PreResponse(ctx *core.Context) {
	if !f.Active {
		return
	}

	entry, has := ctx.Out[debugEntryKey].(map[string]any)
	if !has {
		return
	}
	if ctx.Response != nil {
		entry["status"] = ctx.Response.Status
		if url, _ := entry["url"].(string); url == "" && ctx.Spec != nil {
			entry["url"] = ctx.Spec.Url
		}
	}
}

func (f *DebugFeature) PreDone(ctx *core.Context) {
	f.finish(ctx, true)
}

func (f *DebugFeature) PreUnexpected(ctx *core.Context) {
	if entry, has := ctx.Out[debugEntryKey].(map[string]any); has {
		if ctx.Ctrl != nil && ctx.Ctrl.Err != nil {
			entry["error"] = ctx.Ctrl.Err.Error()
		}
	}
	f.finish(ctx, false)
}

func (f *DebugFeature) finish(ctx *core.Context, ok bool) {
	// Finish once per operation: the marker in ctx.Out is consumed here.
	entry, has := ctx.Out[debugEntryKey].(map[string]any)
	if !has {
		return
	}
	delete(ctx.Out, debugEntryKey)

	entry["ok"] = ok && (ctx.Result == nil || ctx.Result.Ok)
	start, _ := entry["start"].(int64)
	dur := foptNow(f.options)() - start
	if dur < 0 {
		dur = 0
	}
	entry["durationMs"] = dur
	if entry["status"] == nil && ctx.Result != nil {
		entry["status"] = ctx.Result.Status
	}

	f.Entries = append(f.Entries, entry)
	max := foptInt(f.options, "max", 100)
	for len(f.Entries) > max {
		f.Entries = f.Entries[1:]
	}

	if onEntry, ok := f.options["onEntry"].(func(map[string]any)); ok {
		onEntry(entry)
	}
}

func (f *DebugFeature) redact(headers map[string]any) map[string]any {
	out := map[string]any{}
	if headers == nil {
		return out
	}
	patterns := foptStrList(f.options, "redact")
	if patterns == nil {
		patterns = debugDefaultRedact
	}
	for k, v := range headers {
		masked := false
		for _, p := range patterns {
			if strings.ToLower(k) == p {
				masked = true
				break
			}
		}
		if masked {
			out[k] = "<redacted>"
		} else {
			out[k] = v
		}
	}
	return out
}
