package utility

import "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"

func makeContextUtil(ctxmap map[string]any, basectx *core.Context) *core.Context {
	return core.NewContext(ctxmap, basectx)
}
