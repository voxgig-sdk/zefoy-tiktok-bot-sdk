package utility

import "GOMODULE/core"

func makeRequestUtil(ctx *core.Context) (*core.Response, error) {
	if ctx.Out["request"] != nil {
		if resp, ok := ctx.Out["request"].(*core.Response); ok {
			return resp, nil
		}
	}

	spec := ctx.Spec
	utility := ctx.Utility

	response := core.NewResponse(map[string]any{})
	result := core.NewResult(map[string]any{})
	ctx.Result = result

	if spec == nil {
		return nil, ctx.MakeError("request_no_spec",
			"Expected context spec property to be defined.")
	}

	fetchdef, err := utility.MakeFetchDef(ctx)
	if err != nil {
		response.Err = err
		ctx.Response = response
		spec.Step = "postrequest"
		return response, nil
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["fetchdef"] = fetchdef
	}

	spec.Step = "prerequest"

	url, _ := fetchdef["url"].(string)
	fetched, fetchErr := utility.Fetcher(ctx, url, fetchdef)

	if fetchErr != nil {
		response.Err = fetchErr
	} else if fetched == nil {
		response = core.NewResponse(map[string]any{
			"err": ctx.MakeError("request_no_response", "response: undefined"),
		})
	} else {
		if fm, ok := fetched.(map[string]any); ok {
			response = core.NewResponse(fm)
		} else {
			response.Err = ctx.MakeError("request_invalid_response", "response: invalid type")
		}
	}

	spec.Step = "postrequest"
	ctx.Response = response

	return response, nil
}
