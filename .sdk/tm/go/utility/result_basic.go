package utility

import (
	"fmt"

	"GOMODULE/core"
)

func resultBasicUtil(ctx *core.Context) *core.Result {
	response := ctx.Response
	result := ctx.Result

	if result != nil && response != nil {
		result.Status = response.Status
		result.StatusText = response.StatusText

		if result.Status >= 400 {
			msg := "request: " + fmt.Sprintf("%d", result.Status) + ": " + result.StatusText
			if result.Err != nil {
				prevmsg := result.Err.Error()
				result.Err = ctx.MakeError("request_status", prevmsg+": "+msg)
			} else {
				result.Err = ctx.MakeError("request_status", msg)
			}
		} else if response.Err != nil {
			result.Err = response.Err
		}
	}

	return result
}
