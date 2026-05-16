package feature

import (
	"fmt"
	"math/rand"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

type TestFeature struct {
	BaseFeature
	client  *core.ProjectNameSDK
	options map[string]any
}

func NewTestFeature() *TestFeature {
	return &TestFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "test",
			Active:  true,
		},
	}
}

func (f *TestFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options

	entity := core.ToMapAny(vs.GetProp(options, "entity"))

	f.client.Mode = "test"

	// Ensure entity ids are correct.
	vs.Walk(entity, func(key *string, val any, parent any, path []string) any {
		if len(path) == 2 {
			if m, ok := val.(map[string]any); ok {
				if key != nil {
					m["id"] = *key
				}
			}
		}
		return val
	})

	self := f

	testFetcher := func(ctx *core.Context, _fullurl string, _fetchdef map[string]any) (any, error) {
		respond := func(status int, data any, extra map[string]any) map[string]any {
			out := map[string]any{
				"status":     status,
				"statusText": "OK",
				"json":       (func() any)(func() any { return data }),
				"body":       "not-used",
			}
			if extra != nil {
				for k, v := range extra {
					out[k] = v
				}
			}
			return out
		}

		op := ctx.Op
		entmap := core.ToMapAny(vs.GetProp(entity, op.Entity))
		if entmap == nil {
			entmap = map[string]any{}
		}

		// For single-entity ops (load, remove) with an empty explicit match,
		// fall back to the id the entity client already knows from a prior
		// create/load (in ctx.Match / ctx.Data). Mirrors the TS mock where
		// param() resolves the id from that accumulated state.
		resolveMatch := func(explicit map[string]any) map[string]any {
			if len(explicit) > 0 {
				return explicit
			}
			for _, src := range []any{ctx.Match, ctx.Data} {
				if src == nil {
					continue
				}
				v := vs.GetProp(src, "id")
				if v != nil && v != "__UNDEFINED__" {
					return map[string]any{"id": v}
				}
			}
			return map[string]any{}
		}

		if op.Name == "load" {
			args := self.buildArgs(ctx, op, resolveMatch(ctx.Reqmatch))
			found := vs.Select(entmap, args)
			ent := vs.GetElem(found, 0)
			if ent == nil {
				return respond(404, nil, map[string]any{"statusText": "Not found"}), nil
			}
			vs.DelProp(ent, "$KEY")
			out := vs.Clone(ent)
			return respond(200, out, nil), nil
		} else if op.Name == "list" {
			args := self.buildArgs(ctx, op, ctx.Reqmatch)
			found := vs.Select(entmap, args)
			if found == nil {
				return respond(404, nil, map[string]any{"statusText": "Not found"}), nil
			}
			for _, item := range found {
				vs.DelProp(item, "$KEY")
			}
			out := vs.Clone(found)
			return respond(200, out, nil), nil
		} else if op.Name == "update" {
			// Match the existing entity by id only (or its alias). Reqdata
			// also contains the new field values, which would otherwise
			// cause Select to filter out the entity we want to update.
			// Falls back to first entity when no match found, mirroring
			// the TS mock.
			updateMatch := map[string]any{}
			if ctx.Reqdata != nil {
				if v, has := ctx.Reqdata["id"]; has {
					updateMatch["id"] = v
				}
				if op.Alias != nil {
					if aliasIdRaw := vs.GetProp(op.Alias, "id"); aliasIdRaw != nil {
						if aliasId, ok := aliasIdRaw.(string); ok {
							if v, has := ctx.Reqdata[aliasId]; has {
								updateMatch[aliasId] = v
							}
						}
					}
				}
			}
			args := self.buildArgs(ctx, op, updateMatch)
			found := vs.Select(entmap, args)
			ent := vs.GetElem(found, 0)
			if ent == nil && entmap != nil {
				for _, e := range entmap {
					if _, ok := e.(map[string]any); ok {
						ent = e
						break
					}
				}
			}
			if ent == nil {
				return respond(404, nil, map[string]any{"statusText": "Not found"}), nil
			}
			if entm, ok := ent.(map[string]any); ok {
				reqdata := ctx.Reqdata
				if reqdata != nil {
					for k, v := range reqdata {
						entm[k] = v
					}
				}
			}
			vs.DelProp(ent, "$KEY")
			out := vs.Clone(ent)
			return respond(200, out, nil), nil
		} else if op.Name == "remove" {
			args := self.buildArgs(ctx, op, resolveMatch(ctx.Reqmatch))
			found := vs.Select(entmap, args)
			ent := vs.GetElem(found, 0)
			// Remove only the first matched entity. If nothing matches,
			// succeed as a no-op rather than erroring.
			if entm, ok := ent.(map[string]any); ok {
				id := vs.GetProp(entm, "id")
				vs.DelProp(entmap, id)
			}
			return respond(200, nil, nil), nil
		} else if op.Name == "create" {
			_ = self.buildArgs(ctx, op, ctx.Reqdata)
			id := ctx.Utility.Param(ctx, "id")
			if id == nil {
				id = fmt.Sprintf("%04x%04x%04x%04x",
					rand.Intn(0x10000), rand.Intn(0x10000),
					rand.Intn(0x10000), rand.Intn(0x10000))
			}

			ent := vs.Clone(ctx.Reqdata)
			if entm, ok := ent.(map[string]any); ok {
				entm["id"] = id
				if idStr, ok := id.(string); ok {
					entmap[idStr] = entm
				}
				vs.DelProp(entm, "$KEY")
				out := vs.Clone(entm)
				return respond(200, out, nil), nil
			}
			return respond(200, ent, nil), nil
		}

		return respond(404, nil, map[string]any{"statusText": "Unknown operation"}), nil
	}

	ctx.Utility.Fetcher = testFetcher
}

func (f *TestFeature) buildArgs(ctx *core.Context, op *core.Operation, args map[string]any) any {
	opname := op.Name

	// Get last point from config.
	points := vs.GetPath([]any{"entity", ctx.Entity.GetName(), "op", opname, "points"}, ctx.Config)
	point := vs.GetElem(points, -1)

	// Get required params.
	paramsPath := vs.GetPath([]any{"args", "params"}, point)
	reqdParams := vs.Select(paramsPath, map[string]any{"reqd": true})
	reqd := vs.Transform(reqdParams, []any{"`$EACH`", "", "`$KEY.name`"})

	qand := []any{}
	q := map[string]any{"`$AND`": &qand}

	if args != nil {
		for _, key := range vs.KeysOf(args) {
			isId := key == "id"
			selected := vs.Select(reqd, key)
			isReqd := !vs.IsEmpty(selected)

			if isId || isReqd {
				v := ctx.Utility.Param(ctx, key)
				ka := vs.GetProp(op.Alias, key)

				qor := []any{map[string]any{key: v}}
				if ka != nil {
					if kas, ok := ka.(string); ok {
						qor = append(qor, map[string]any{kas: v})
					}
				}

				qand = append(qand, map[string]any{"`$OR`": qor})
			}
		}
	}

	// Update the slice behind the pointer.
	q["`$AND`"] = qand

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["test"] = map[string]any{"query": q}
	}

	return q
}
