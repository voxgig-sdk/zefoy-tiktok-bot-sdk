package utility

import "GOMODULE/core"

func doneUtil(ctx *core.Context) (any, error) {
	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain = cleanUtil(ctx, ctx.Ctrl.Explain).(map[string]any)
		if explainResult, ok := ctx.Ctrl.Explain["result"]; ok {
			if rm, ok := explainResult.(map[string]any); ok {
				delete(rm, "err")
			}
		}
	}

	if ctx.Result != nil && ctx.Result.Ok {
		return ctx.Result.Resdata, nil
	}

	return makeErrorUtil(ctx, nil)
}
