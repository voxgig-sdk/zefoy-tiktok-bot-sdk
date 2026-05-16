package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func paramUtil(ctx *core.Context, paramdef any) any {
	point := ctx.Point
	spec := ctx.Spec
	match := ctx.Match
	reqmatch := ctx.Reqmatch
	data := ctx.Data
	reqdata := ctx.Reqdata

	pt := vs.Typify(paramdef)

	var key string
	if 0 < (vs.T_string & pt) {
		key, _ = paramdef.(string)
	} else {
		k := vs.GetProp(paramdef, "name")
		key, _ = k.(string)
	}

	var akey string
	if point != nil {
		alias := core.ToMapAny(vs.GetProp(point, "alias"))
		if alias != nil {
			if ak := vs.GetProp(alias, key); ak != nil {
				akey, _ = ak.(string)
			}
		}
	}

	val := vs.GetProp(reqmatch, key)

	if val == nil {
		val = vs.GetProp(match, key)
	}

	if val == nil && akey != "" {
		if spec != nil {
			spec.Alias[akey] = key
		}
		val = vs.GetProp(reqmatch, akey)
	}

	if val == nil {
		val = vs.GetProp(reqdata, key)
	}

	if val == nil {
		val = vs.GetProp(data, key)
	}

	if val == nil && akey != "" {
		val = vs.GetProp(reqdata, akey)
		if val == nil {
			val = vs.GetProp(data, akey)
		}
	}

	return val
}
