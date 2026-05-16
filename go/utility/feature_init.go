package utility

import (
	vs "github.com/voxgig/struct"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/core"
)

func featureInitUtil(ctx *core.Context, f core.Feature) {
	fname := f.GetName()
	fopts := map[string]any{}

	if ctx.Options != nil {
		if featureOpts := vs.GetProp(ctx.Options, "feature"); featureOpts != nil {
			if fm, ok := featureOpts.(map[string]any); ok {
				if fo := vs.GetProp(fm, fname); fo != nil {
					if fom, ok := fo.(map[string]any); ok {
						fopts = fom
					}
				}
			}
		}
	}

	if active, ok := fopts["active"]; ok {
		if ab, ok := active.(bool); ok && ab {
			f.Init(ctx, fopts)
		}
	}
}
