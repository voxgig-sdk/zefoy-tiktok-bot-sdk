package utility

import (
	vs "github.com/voxgig/struct"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/core"
)

func transformRequestUtil(ctx *core.Context) any {
	spec := ctx.Spec
	point := ctx.Point

	if spec != nil {
		spec.Step = "reqform"
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return ctx.Reqdata
	}

	reqform := vs.GetProp(transform, "req")
	if reqform == nil {
		return ctx.Reqdata
	}

	reqdata := vs.Transform(map[string]any{
		"reqdata": ctx.Reqdata,
	}, reqform)

	return reqdata
}
