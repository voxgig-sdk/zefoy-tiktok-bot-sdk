package entity

import (
	"GOMODULE/core"

	vs "github.com/voxgig/struct"
)

type entityUpdateOp struct{}

// EJECT-START

func (e *EntyClass) Update(reqdata map[string]any, ctrl map[string]any) (any, error) {
	utility := e.utility
	ctx := utility.MakeContext(map[string]any{
		"opname":  "update",
		"ctrl":    ctrl,
		"match":   e.match,
		"data":    e.data,
		"reqdata": reqdata,
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

// UpdateTyped is the statically-typed variant of Update: it takes an
// EntityNameUpdateData and returns an EntityName. It delegates to the untyped
// Update (identical runtime) and converts at the typed boundary.
func (e *EntyClass) UpdateTyped(reqdata EntityNameUpdateData, ctrl map[string]any) (EntityName, error) {
	res, err := e.Update(asMap(reqdata), ctrl)
	if err != nil {
		return EntityName{}, err
	}
	return typedFrom[EntityName](res), nil
}

// EJECT-END
