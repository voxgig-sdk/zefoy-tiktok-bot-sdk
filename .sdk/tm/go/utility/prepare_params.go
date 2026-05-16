package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareParamsUtil(ctx *core.Context) map[string]any {
	utility := ctx.Utility
	point := ctx.Point

	var params []any
	if args := vs.GetProp(point, "args"); args != nil {
		if argsMap, ok := args.(map[string]any); ok {
			if p := vs.GetProp(argsMap, "params"); p != nil {
				if pl, ok := p.([]any); ok {
					params = pl
				}
			}
		}
	}
	if params == nil {
		params = []any{}
	}

	out := map[string]any{}
	for _, pd := range params {
		val := utility.Param(ctx, pd)
		if val != nil {
			if pdm, ok := pd.(map[string]any); ok {
				name, _ := vs.GetProp(pdm, "name").(string)
				if name != "" {
					out[name] = val
				}
			}
		}
	}

	return out
}
