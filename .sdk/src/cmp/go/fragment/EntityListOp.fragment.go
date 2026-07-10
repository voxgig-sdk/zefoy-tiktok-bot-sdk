package entity

type entityListOp struct{}

// EJECT-START

func (e *EntyClass) List(reqmatch map[string]any, ctrl map[string]any) (any, error) {
	utility := e.utility
	ctx := utility.MakeContext(map[string]any{
		"opname":   "list",
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
		}
	})
}

// ListTyped is the statically-typed variant of List: it takes an
// EntityNameListMatch and returns []EntityName. It delegates to the untyped
// List (identical runtime) and converts at the typed boundary.
func (e *EntyClass) ListTyped(reqmatch EntityNameListMatch, ctrl map[string]any) ([]EntityName, error) {
	res, err := e.List(asMap(reqmatch), ctrl)
	if err != nil {
		return nil, err
	}
	return typedSliceFrom[EntityName](res), nil
}

// EJECT-END
