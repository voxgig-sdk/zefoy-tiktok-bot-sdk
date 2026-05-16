package utility

import "GOMODULE/core"

func makeResultUtil(ctx *core.Context) (*core.Result, error) {
	if ctx.Out["result"] != nil {
		if res, ok := ctx.Out["result"].(*core.Result); ok {
			return res, nil
		}
	}

	utility := ctx.Utility
	op := ctx.Op
	entity := ctx.Entity
	spec := ctx.Spec
	result := ctx.Result

	if spec == nil {
		return nil, ctx.MakeError("result_no_spec",
			"Expected context spec property to be defined.")
	}
	if result == nil {
		return nil, ctx.MakeError("result_no_result",
			"Expected context result property to be defined.")
	}

	spec.Step = "result"

	utility.TransformResponse(ctx)

	if op.Name == "list" {
		resdata := result.Resdata
		result.Resdata = []any{}

		if resdata != nil {
			if list, ok := resdata.([]any); ok && len(list) > 0 && entity != nil {
				var entities []any
				for _, entry := range list {
					ent := entity.Make()
					if entryMap, ok := entry.(map[string]any); ok {
						ent.Data(entryMap)
					}
					entities = append(entities, ent)
				}
				result.Resdata = entities
			}
		}
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["result"] = result
	}

	return result, nil
}
