package utility

import (
	vs "github.com/voxgig/struct"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/core"
)

func prepareHeadersUtil(ctx *core.Context) map[string]any {
	options := ctx.Client.OptionsMap()

	headers := vs.GetProp(options, "headers")
	if headers == nil {
		return map[string]any{}
	}

	out := vs.Clone(headers)
	if om, ok := out.(map[string]any); ok {
		return om
	}
	return map[string]any{}
}
