package utility

import "GOMODULE/core"

func makeResponseUtil(ctx *core.Context) (*core.Response, error) {
	if ctx.Out["response"] != nil {
		if resp, ok := ctx.Out["response"].(*core.Response); ok {
			return resp, nil
		}
	}

	utility := ctx.Utility
	spec := ctx.Spec
	result := ctx.Result
	response := ctx.Response

	if spec == nil {
		return nil, ctx.MakeError("response_no_spec",
			"Expected context spec property to be defined.")
	}
	if response == nil {
		return nil, ctx.MakeError("response_no_response",
			"Expected context response property to be defined.")
	}
	if result == nil {
		return nil, ctx.MakeError("response_no_result",
			"Expected context result property to be defined.")
	}

	spec.Step = "response"

	utility.ResultBasic(ctx)
	utility.ResultHeaders(ctx)
	utility.ResultBody(ctx)
	utility.TransformResponse(ctx)

	if result.Err == nil {
		result.Ok = true
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["result"] = result
	}

	return response, nil
}
