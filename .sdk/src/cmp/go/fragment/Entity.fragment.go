package entity

import (
	"GOMODULE/core"

	vs "github.com/voxgig/struct"
)

type EntyClass struct {
	name    string
	client  *core.ProjectNameSDK
	utility *core.Utility
	entopts map[string]any
	data    map[string]any
	match   map[string]any
	entctx  *core.Context
	deleted bool
}

func NewEntyClass(client *core.ProjectNameSDK, entopts map[string]any) *EntyClass {
	if entopts == nil {
		entopts = map[string]any{}
	}
	if _, ok := entopts["active"]; !ok {
		entopts["active"] = true
	} else if entopts["active"] == false {
		// keep false
	} else {
		entopts["active"] = true
	}

	e := &EntyClass{
		name:    "entityname",
		client:  client,
		utility: client.GetUtility(),
		entopts: entopts,
		data:    map[string]any{},
		match:   map[string]any{},
	}

	e.entctx = e.utility.MakeContext(map[string]any{
		"entity":  e,
		"entopts": entopts,
	}, client.GetRootCtx())

	e.utility.FeatureHook(e.entctx, "PostConstructEntity")

	return e
}

func (e *EntyClass) GetName() string { return e.name }

// Deleted marks this instance as removed. `Remove` resolves to the entity
// like every other operation, and the instance KEEPS the data it held — a
// caller can still read what was deleted — but it is no longer a live
// record. See AGENTS.md "Entity operations return ENTITIES".
func (e *EntyClass) MarkDeleted() {
	e.deleted = true
}


// Deleted reports whether a successful Remove has resolved on this instance.
func (e *EntyClass) Deleted() bool {
	return e.deleted
}


func (e *EntyClass) Make() core.Entity {
	opts := map[string]any{}
	for k, v := range e.entopts {
		opts[k] = v
	}
	return NewEntyClass(e.client, opts)
}

func (e *EntyClass) Data(args ...any) any {
	if len(args) > 0 && args[0] != nil {
		e.data = core.ToMapAny(vs.Clone(args[0]))
		if e.data == nil {
			e.data = map[string]any{}
		}
		e.utility.FeatureHook(e.entctx, "SetData")
	}

	e.utility.FeatureHook(e.entctx, "GetData")
	out := vs.Clone(e.data)
	return out
}

func (e *EntyClass) Match(args ...any) any {
	if len(args) > 0 && args[0] != nil {
		e.match = core.ToMapAny(vs.Clone(args[0]))
		if e.match == nil {
			e.match = map[string]any{}
		}
		e.utility.FeatureHook(e.entctx, "SetMatch")
	}

	e.utility.FeatureHook(e.entctx, "GetMatch")
	out := vs.Clone(e.match)
	return out
}

// DataTyped is the statically-typed accessor for this entity's data. With no
// argument it returns the current data as an EntityName; with an argument it
// sets the data and returns the stored value. It delegates to the untyped Data
// (identical runtime) and converts at the typed boundary.
func (e *EntyClass) DataTyped(data ...EntityName) EntityName {
	if len(data) > 0 {
		return typedFrom[EntityName](e.Data(asMap(data[0])))
	}
	return typedFrom[EntityName](e.Data())
}

// MatchTyped mirrors DataTyped for the entity's match filter. The match is a
// partial of the entity, so it round-trips through EntityName (all fields
// optional at the wire level).
func (e *EntyClass) MatchTyped(match ...EntityName) EntityName {
	if len(match) > 0 {
		return typedFrom[EntityName](e.Match(asMap(match[0])))
	}
	return typedFrom[EntityName](e.Match())
}

// Stream (feature #4). Runs `action` through the full pipeline and returns a
// channel over result items, so the `streaming` feature's incremental output
// is reachable from a generated entity (a normal op call materialises the
// whole result). `callopts` parameterises the call:
//   - inbound (download): the channel yields items/chunks (from the streaming
//     feature when active, else the materialised items);
//   - outbound (upload): a `body` in callopts is attached to the request so the
//     transport can stream the payload;
//   - `ctrl` (pipeline control) and `signal` (a done channel) are honoured.
func (e *EntyClass) Stream(action string, args map[string]any, callopts map[string]any) <-chan any {
	out := make(chan any)

	if callopts == nil {
		callopts = map[string]any{}
	}

	var signal <-chan struct{}
	switch s := callopts["signal"].(type) {
	case <-chan struct{}:
		signal = s
	case chan struct{}:
		signal = s
	}

	ctrl := map[string]any{}
	if c := core.ToMapAny(callopts["ctrl"]); c != nil {
		for k, v := range c {
			ctrl[k] = v
		}
	}

	ctxmap := map[string]any{
		"opname": action,
		"ctrl":   ctrl,
		"match":  e.match,
		"data":   e.data,
	}
	for k, v := range args {
		ctxmap[k] = v
	}

	utility := e.utility
	ctx := utility.MakeContext(ctxmap, e.entctx)
	ctx.Meta["stream"] = callopts

	// Outbound: expose the caller's payload so the request builder / transport
	// can stream it as the request body.
	if body := callopts["body"]; body != nil {
		ctx.Reqdata["body$"] = body
		ctx.Meta["stream_out"] = body
	}

	send := func(item any) bool {
		select {
		case <-signal:
			return false
		case out <- item:
			return true
		}
	}

	go func() {
		defer close(out)

		utility.FeatureHook(ctx, "PrePoint")
		point, err := utility.MakePoint(ctx)
		ctx.Out["point"] = point
		if err != nil {
			return
		}

		utility.FeatureHook(ctx, "PreSpec")
		spec, err := utility.MakeSpec(ctx)
		ctx.Out["spec"] = spec
		if err != nil {
			return
		}

		utility.FeatureHook(ctx, "PreRequest")
		req, err := utility.MakeRequest(ctx)
		ctx.Out["request"] = req
		if err != nil {
			return
		}

		utility.FeatureHook(ctx, "PreResponse")
		resp, err := utility.MakeResponse(ctx)
		ctx.Out["response"] = resp
		if err != nil {
			return
		}

		utility.FeatureHook(ctx, "PreResult")
		result, err := utility.MakeResult(ctx)
		ctx.Out["result"] = result
		if err != nil {
			return
		}

		utility.FeatureHook(ctx, "PreDone")

		// Inbound: prefer the streaming feature's incremental iterator; else
		// fall back to the materialised items so Stream always yields.
		if ctx.Result != nil && ctx.Result.Stream != nil {
			for item := range ctx.Result.Stream() {
				if !send(item) {
					return
				}
			}
			return
		}

		data, derr := utility.Done(ctx)
		if derr != nil {
			return
		}
		switch d := data.(type) {
		case []any:
			for _, item := range d {
				if !send(item) {
					return
				}
			}
		case nil:
			// nothing to yield
		default:
			send(d)
		}
	}()

	return out
}

// #LoadOp

// #ListOp

// #CreateOp

// #UpdateOp

// #RemoveOp

func (e *EntyClass) runOp(ctx *core.Context, postDone func()) (any, error) {
	utility := e.utility

	// #PrePoint-Hook

	point, err := utility.MakePoint(ctx)
	ctx.Out["point"] = point
	if err != nil {
		return utility.MakeError(ctx, err)
	}

	// #PreSpec-Hook

	spec, err := utility.MakeSpec(ctx)
	ctx.Out["spec"] = spec
	if err != nil {
		return utility.MakeError(ctx, err)
	}

	// #PreRequest-Hook

	resp, err := utility.MakeRequest(ctx)
	ctx.Out["request"] = resp
	if err != nil {
		return utility.MakeError(ctx, err)
	}

	// #PreResponse-Hook

	resp2, err := utility.MakeResponse(ctx)
	ctx.Out["response"] = resp2
	if err != nil {
		return utility.MakeError(ctx, err)
	}

	// #PreResult-Hook

	result, err := utility.MakeResult(ctx)
	ctx.Out["result"] = result
	if err != nil {
		return utility.MakeError(ctx, err)
	}

	// #PreDone-Hook

	postDone()

	out, doneErr := utility.Done(ctx)
	if doneErr != nil {
		return out, doneErr
	}

	// An operation resolves to the ENTITY, not the raw data. Entities are
	// stateful: post_done has just absorbed resdata/resmatch into this
	// instance, and the caller reaches the record through data(). Two
	// structural exceptions: `list` resolves to the ARRAY of entity
	// instances make_result built, and a failed op with throwing disabled
	// hands back the error payload unchanged. `remove` additionally marks
	// the entity deleted; it KEEPS its data, so a caller can still read
	// what was removed. See AGENTS.md "Entity operations return ENTITIES".
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}

	if ctx.Result != nil && ctx.Result.Ok && opname != "list" {
		if opname == "remove" {
			e.MarkDeleted()
		}
		return e, nil
	}

	return out, nil
}
