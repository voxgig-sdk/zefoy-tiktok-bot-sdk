package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makePointUtil(ctx *core.Context) (map[string]any, error) {
	if ctx.Out["point"] != nil {
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
		for i := 0; i < len(op.Points); i++ {
			point = op.Points[i]
			selectDef := core.ToMapAny(vs.GetProp(point, "select"))
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
				break
			}
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
