package entity

import (
	"GOMODULE/core"

	vs "github.com/voxgig/struct"
)

type entityCreateOp struct{}

// EJECT-START

func (e *EntyClass) Create(reqdata map[string]any, ctrl map[string]any) (any, error) {
	utility := e.utility
	ctx := utility.MakeContext(map[string]any{
		"opname":  "create",
		"ctrl":    ctrl,
		"match":   e.match,
		"data":    e.data,
		"reqdata": reqdata,
	}, e.entctx)

	return e.runOp(ctx, func() {
		if ctx.Result != nil {
			if ctx.Result.Resdata != nil {
				e.data = core.ToMapAny(vs.Clone(ctx.Result.Resdata))
				if e.data == nil {
					e.data = map[string]any{}
				}
			}
		}
	})
}

// CreateTyped is the statically-typed variant of Create: it takes an
// EntityNameCreateData and returns an EntityName. It delegates to the untyped
// Create (identical runtime) and converts at the typed boundary.
func (e *EntyClass) CreateTyped(reqdata EntityNameCreateData, ctrl map[string]any) (EntityName, error) {
	res, err := e.Create(asMap(reqdata), ctrl)
	if err != nil {
		return EntityName{}, err
	}
	return typedFrom[EntityName](res), nil
}

// EJECT-END
