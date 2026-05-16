package utility

import "GOMODULE/core"

func resultHeadersUtil(ctx *core.Context) *core.Result {
	response := ctx.Response
	result := ctx.Result

	if result != nil {
		if response != nil && response.Headers != nil {
			if hm, ok := response.Headers.(map[string]any); ok {
				result.Headers = hm
			} else {
				result.Headers = map[string]any{}
			}
		} else {
			result.Headers = map[string]any{}
		}
	}

	return result
}
