package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeSpecUtil(ctx *core.Context) (*core.Spec, error) {
	if ctx.Out["spec"] != nil {
		if sp, ok := ctx.Out["spec"].(*core.Spec); ok {
			ctx.Spec = sp
			return sp, nil
		}
	}

	point := ctx.Point
	options := ctx.Options
	utility := ctx.Utility

	base, _ := vs.GetProp(options, "base").(string)
	prefix, _ := vs.GetProp(options, "prefix").(string)
	suffix, _ := vs.GetProp(options, "suffix").(string)

	var parts []any
	if p := vs.GetProp(point, "parts"); p != nil {
		if pl, ok := p.([]any); ok {
			parts = pl
		}
	}

	ctx.Spec = core.NewSpec(map[string]any{
		"base":   base,
		"prefix": prefix,
		"parts":  parts,
		"suffix": suffix,
		"step":   "start",
	})

	ctx.Spec.Method = utility.PrepareMethod(ctx)

	allowMethod, _ := vs.GetPath([]any{"allow", "method"}, options).(string)
	if !strings.Contains(allowMethod, ctx.Spec.Method) {
		return nil, ctx.MakeError("spec_method_allow",
			"Method \""+ctx.Spec.Method+
				"\" not allowed by SDK option allow.method value: \""+allowMethod+"\"")
	}

	ctx.Spec.Params = utility.PrepareParams(ctx)
	ctx.Spec.Query = utility.PrepareQuery(ctx)
	ctx.Spec.Headers = utility.PrepareHeaders(ctx)

	kind, _ := vs.GetProp(point, "kind").(string)

	if kind == "graphql" {
		// GraphQL addresses one endpoint: no path parts, no query string,
		// and the body carries the operation. PrepareBody is skipped
		// deliberately — it only emits a body for data-input ops, whereas
		// every GraphQL op posts one, including load/list/remove.
		ctx.Spec.Body = utility.GraphqlBody(ctx)
		ctx.Spec.Path = ""
		// PrepareQuery already copied the op's match arguments into the
		// query string. Those same values are bound as operation
		// variables, so leaving them would send /graphql?id=i1.
		ctx.Spec.Query = map[string]any{}
		ctx.Spec.Headers["content-type"] = GraphqlContentType
	} else {
		ctx.Spec.Body = utility.PrepareBody(ctx)
		ctx.Spec.Path = utility.PreparePath(ctx)
	}

	if ctx.Ctrl.Explain != nil {
		ctx.Ctrl.Explain["spec"] = ctx.Spec
	}

	spec, err := utility.PrepareAuth(ctx)
	if err != nil {
		return nil, err
	}

	ctx.Spec = spec
	return spec, nil
}
