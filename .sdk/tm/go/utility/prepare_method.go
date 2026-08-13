package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func prepareMethodUtil(ctx *core.Context) string {
	opname := ctx.Op.Name

	// The API definition is authoritative: a POST-only or PATCH-based API
	// exposes `update` as POST or PATCH, not the PUT the op name implies.
	// Only fall back to the op-name convention when the point has no method.
	if m, ok := vs.GetProp(ctx.Point, "method").(string); ok && "" != m {
		return strings.ToUpper(m)
	}

	methodMap := map[string]string{
		"create": "POST",
		"update": "PUT",
		"load":   "GET",
		"list":   "GET",
		"remove": "DELETE",
		"patch":  "PATCH",
	}

	if m, ok := methodMap[opname]; ok {
		return m
	}
	return "GET"
}
