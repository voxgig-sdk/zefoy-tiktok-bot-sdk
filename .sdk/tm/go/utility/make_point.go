package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

// How many path segments a point has.
func partsLen(point map[string]any) int {
	if parts, ok := vs.GetProp(point, "parts").([]any); ok {
		return len(parts)
	}
	return 0
}

// Does this point's path end in a parameter? A record route ends in the
// record's identifier (`/boards/{id}`); a cross-reference that also returns
// the entity ends in the relationship's name (`/posts/{id}/author`).
func terminalParam(point map[string]any) bool {
	parts, ok := vs.GetProp(point, "parts").([]any)
	if !ok || 0 == len(parts) {
		return false
	}
	last, _ := parts[len(parts)-1].(string)
	return strings.HasPrefix(last, "{")
}

// The entity's OWN route among an op's points: a terminal parameter first,
// then the fewest path segments. Ties keep the earlier point, so the model's
// sorted-key order decides. The same rule runs at generation time, in
// helpers/opShape.ts — a template ships standalone, so both sides must move
// together.
func ownPoint(points []map[string]any) map[string]any {
	best := points[0]
	for _, cand := range points {
		candTerm := terminalParam(cand)
		bestTerm := terminalParam(best)
		if candTerm != bestTerm {
			if candTerm {
				best = cand
			}
		} else if partsLen(cand) < partsLen(best) {
			best = cand
		}
	}
	return best
}

func makePointUtil(ctx *core.Context) (map[string]any, error) {
	if ctx.Out["point"] != nil {
		// A PrePoint feature hook (e.g. rbac) may short-circuit the
		// operation by storing an error here; surface it before any
		// endpoint resolution or network activity.
		if err, ok := ctx.Out["point"].(error); ok {
			return nil, err
		}
		if tm, ok := ctx.Out["point"].(map[string]any); ok {
			ctx.Point = tm
			return tm, nil
		}
	}

	op := ctx.Op
	options := ctx.Options

	allowOp, _ := vs.GetPath([]any{"allow", "op"}, options).(string)
	if !strings.Contains(allowOp, op.Name) {
		return nil, ctx.MakeError("point_op_allow",
			"Operation \""+op.Name+
				"\" not allowed by SDK option allow.op value: \""+allowOp+"\"")
	}

	if len(op.Points) == 0 {
		return nil, ctx.MakeError("point_no_points",
			"Operation \""+op.Name+"\" has no endpoint definitions.")
	}

	if len(op.Points) == 1 {
		ctx.Point = op.Points[0]
	} else {
		var reqselector map[string]any
		var selector map[string]any

		if op.Input == "data" {
			reqselector = ctx.Reqdata
			selector = ctx.Data
		} else {
			reqselector = ctx.Reqmatch
			selector = ctx.Match
		}

		var point map[string]any
		matched := false
		for i := 0; i < len(op.Points); i++ {
			cand := op.Points[i]
			selectDef := core.ToMapAny(vs.GetProp(cand, "select"))
			found := true

			if selector != nil && selectDef != nil {
				if exist := vs.GetProp(selectDef, "exist"); exist != nil {
					if existList, ok := exist.([]any); ok {
						for _, ek := range existList {
							existkey, _ := ek.(string)
							rv := vs.GetProp(reqselector, existkey)
							sv := vs.GetProp(selector, existkey)
							if rv == nil && sv == nil {
								found = false
								break
							}
						}
					}
				}
			}

			if found {
				reqAction := vs.GetProp(reqselector, "$action")
				selectAction := vs.GetProp(selectDef, "$action")
				if reqAction != selectAction {
					found = false
				}
			}

			if found {
				point = cand
				matched = true
				break
			}
		}

		// select.exist can list more than the params needed to pick a point,
		// so nothing matches — fall back to the entity's own route rather
		// than whichever point came last.
		if !matched {
			// A request naming an action reaches here only because that
			// action's own point failed its exist test, so it is unbuildable
			// whatever we pick. Refuse it BEFORE choosing a fallback: the
			// guard below compares the chosen point's $action and would wave
			// the request through whenever the fallback lands on the action
			// point itself.
			if reqselector != nil && vs.GetProp(reqselector, "$action") != nil {
				return nil, ctx.MakeError("point_action_invalid",
					"Operation \""+op.Name+
						"\" action \""+vs.Stringify(vs.GetProp(reqselector, "$action"))+
						"\" is not valid.")
			}

			point = ownPoint(op.Points)
		}

		if reqselector != nil {
			reqAction := vs.GetProp(reqselector, "$action")
			if reqAction != nil && point != nil {
				pointSelect := core.ToMapAny(vs.GetProp(point, "select"))
				pointAction := vs.GetProp(pointSelect, "$action")
				if reqAction != pointAction {
					return nil, ctx.MakeError("point_action_invalid",
						"Operation \""+op.Name+
							"\" action \""+vs.Stringify(reqAction)+"\" is not valid.")
				}
			}
		}

		ctx.Point = point
	}

	return ctx.Point, nil
}
