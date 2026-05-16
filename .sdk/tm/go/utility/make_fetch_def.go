package utility

import (
	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeFetchDefUtil(ctx *core.Context) (map[string]any, error) {
	spec := ctx.Spec
	if spec == nil {
		return nil, ctx.MakeError("fetchdef_no_spec",
			"Expected context spec property to be defined.")
	}

	if ctx.Result == nil {
		ctx.Result = core.NewResult(map[string]any{})
	}

	spec.Step = "prepare"

	url, err := ctx.Utility.MakeUrl(ctx)
	if err != nil {
		return nil, err
	}

	spec.Url = url

	fetchdef := map[string]any{
		"url":     url,
		"method":  spec.Method,
		"headers": spec.Headers,
	}

	if spec.Body != nil {
		if _, ok := spec.Body.(map[string]any); ok {
			fetchdef["body"] = vs.Jsonify(spec.Body)
		} else {
			fetchdef["body"] = spec.Body
		}
	}

	return fetchdef, nil
}
