package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func transformResponseUtil(ctx *core.Context) any {
	spec := ctx.Spec
	result := ctx.Result
	point := ctx.Point

	if spec != nil {
		spec.Step = "resform"
	}

	if result == nil || !result.Ok {
		return nil
	}

	transform := core.ToMapAny(vs.GetProp(point, "transform"))
	if transform == nil {
		return nil
	}

	resform := vs.GetProp(transform, "res")
	if resform == nil {
		return nil
	}

	resdata := vs.Transform(map[string]any{
		"ok":         result.Ok,
		"status":     result.Status,
		"statusText": result.StatusText,
		"headers":    result.Headers,
		"body":       result.Body,
		"err":        result.Err,
		"resdata":    result.Resdata,
		"resmatch":   result.Resmatch,
	}, resform)

	result.Resdata = resdata
	return resdata
}
