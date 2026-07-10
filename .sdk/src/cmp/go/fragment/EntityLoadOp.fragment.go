package entity

import (
	"GOMODULE/core"

	vs "github.com/voxgig/struct"
)

type entityLoadOp struct{}

// EJECT-START

func (e *EntyClass) Load(reqmatch map[string]any, ctrl map[string]any) (any, error) {
	utility := e.utility
	ctx := utility.MakeContext(map[string]any{
		"opname":   "load",
		"ctrl":     ctrl,
		"match":    e.match,
		"data":     e.data,
		"reqmatch": reqmatch,
	}, e.entctx)

	return e.runOp(ctx, func() {
		if ctx.Result != nil {
			if ctx.Result.Resmatch != nil {
				e.match = ctx.Result.Resmatch
			}
			if ctx.Result.Resdata != nil {
				e.data = core.ToMapAny(vs.Clone(ctx.Result.Resdata))
				if e.data == nil {
					e.data = map[string]any{}
				}
			}
		}
	})
}

// LoadTyped is the statically-typed variant of Load: it takes an
// EntityNameLoadMatch and returns an EntityName. It delegates to the untyped
// Load (identical runtime) and converts at the typed boundary.
func (e *EntyClass) LoadTyped(reqmatch EntityNameLoadMatch, ctrl map[string]any) (EntityName, error) {
	res, err := e.Load(asMap(reqmatch), ctrl)
	if err != nil {
		return EntityName{}, err
	}
	return typedFrom[EntityName](res), nil
}

// EJECT-END
