package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareQueryUtil(ctx *core.Context) map[string]any {
	point := ctx.Point
	reqmatch := ctx.Reqmatch
	if reqmatch == nil {
		reqmatch = map[string]any{}
	}

	var params []any
	if point != nil {
		if p := vs.GetProp(point, "params"); p != nil {
			if pl, ok := p.([]any); ok {
				params = pl
			}
		}
	}
	if params == nil {
		params = []any{}
	}

	out := map[string]any{}
	for _, item := range vs.Items(reqmatch) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil && !containsStr(params, key) {
			out[key] = val
		}
	}

	return out
}

func containsStr(list []any, s string) bool {
	for _, v := range list {
		if vs, ok := v.(string); ok && vs == s {
			return true
		}
	}
	return false
}
