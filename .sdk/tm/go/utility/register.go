package utility

import "GOMODULE/core"

func init() {
	core.UtilityRegistrar = registerAll
}

func registerAll(u *core.Utility) {
	u.Clean = cleanUtil
	u.Done = doneUtil
	u.MakeError = makeErrorUtil
	u.FeatureAdd = featureAddUtil
	u.FeatureHook = featureHookUtil
	u.FeatureInit = featureInitUtil
	u.Fetcher = fetcherUtil
	u.MakeFetchDef = makeFetchDefUtil
	u.MakeContext = makeContextUtil
	u.MakeOptions = makeOptionsUtil
	u.MakeRequest = makeRequestUtil
	u.MakeResponse = makeResponseUtil
	u.MakeResult = makeResultUtil
	u.MakePoint = makePointUtil
	u.MakeSpec = makeSpecUtil
	u.MakeUrl = makeUrlUtil
	u.Param = paramUtil
	u.PrepareAuth = prepareAuthUtil
	u.PrepareBody = prepareBodyUtil
	u.PrepareHeaders = prepareHeadersUtil
	u.PrepareMethod = prepareMethodUtil
	u.PrepareParams = prepareParamsUtil
	u.PreparePath = preparePathUtil
	u.PrepareQuery = prepareQueryUtil
	u.GraphqlBody = graphqlBodyUtil
	u.GraphqlErrors = graphqlErrorsUtil
	u.ResultBasic = resultBasicUtil
	u.ResultBody = resultBodyUtil
	u.ResultHeaders = resultHeadersUtil
	u.TransformRequest = transformRequestUtil
	u.TransformResponse = transformResponseUtil
}

// overrideUtil replaces one utility member from `options.utility`, matching
// the ts reference: a key naming a real utility member REPLACES it, and any
// other key is attached as a custom extra.
//
// Without this the override was a no-op here. `makeOptions` put every entry
// in `u.Custom`, which nothing reads, so a caller passing
// `utility: {"fetcher": myTransport}` - the documented way to script the
// transport, and the seam the shared feature corpus runs on - was silently
// ignored while ts and js honoured it. The custom-utility test did not catch
// it because it asserted the side map rather than the behaviour.
//
// Returns false when the key names no member, or when the value is not that
// member's signature; the caller then keeps it in Custom. A wrong signature
// is deliberately NOT an error: ts attaches whatever it is given, so a typed
// port that rejected it outright would diverge in the other direction.
//
// Keep this list in step with registerAll above - a utility added to one and
// not the other is overridable in ts and not here, which is the divergence
// this exists to remove.
func overrideUtil(u *core.Utility, key string, val any) bool {
	switch key {
	case "clean":
		if fn, ok := val.(func(ctx *core.Context, val any) any); ok {
			u.Clean = fn
			return true
		}
	case "done":
		if fn, ok := val.(func(ctx *core.Context) (any, error)); ok {
			u.Done = fn
			return true
		}
	case "makeError":
		if fn, ok := val.(func(ctx *core.Context, err error) (any, error)); ok {
			u.MakeError = fn
			return true
		}
	case "featureAdd":
		if fn, ok := val.(func(ctx *core.Context, f core.Feature)); ok {
			u.FeatureAdd = fn
			return true
		}
	case "featureHook":
		if fn, ok := val.(func(ctx *core.Context, name string)); ok {
			u.FeatureHook = fn
			return true
		}
	case "featureInit":
		if fn, ok := val.(func(ctx *core.Context, f core.Feature)); ok {
			u.FeatureInit = fn
			return true
		}
	case "fetcher":
		// BOTH SPELLINGS. Fetcher is the one member declared as a NAMED type,
		// and a type assertion to a defined type matches only that exact
		// dynamic type. A plain function literal in a map[string]any - the
		// ordinary way to write this - carries the UNNAMED signature and
		// asserts to `func(...)` but not to `core.FetcherFunc`; a value the
		// caller converted asserts to `core.FetcherFunc` but not to the
		// unnamed one. Accepting only the named type shelved every ordinary
		// caller's transport in Custom, which is the exact defect this
		// function exists to remove.
		if fn, ok := val.(core.FetcherFunc); ok {
			u.Fetcher = fn
			return true
		}
		if fn, ok := val.(func(ctx *core.Context, fullurl string,
			fetchdef map[string]any) (any, error)); ok {
			u.Fetcher = fn
			return true
		}
	case "makeFetchDef":
		if fn, ok := val.(func(ctx *core.Context) (map[string]any, error)); ok {
			u.MakeFetchDef = fn
			return true
		}
	case "makeContext":
		if fn, ok := val.(func(ctxmap map[string]any, basectx *core.Context) *core.Context); ok {
			u.MakeContext = fn
			return true
		}
	case "makeOptions":
		if fn, ok := val.(func(ctx *core.Context) map[string]any); ok {
			u.MakeOptions = fn
			return true
		}
	case "makeRequest":
		if fn, ok := val.(func(ctx *core.Context) (*core.Response, error)); ok {
			u.MakeRequest = fn
			return true
		}
	case "makeResponse":
		if fn, ok := val.(func(ctx *core.Context) (*core.Response, error)); ok {
			u.MakeResponse = fn
			return true
		}
	case "makeResult":
		if fn, ok := val.(func(ctx *core.Context) (*core.Result, error)); ok {
			u.MakeResult = fn
			return true
		}
	case "makePoint":
		if fn, ok := val.(func(ctx *core.Context) (map[string]any, error)); ok {
			u.MakePoint = fn
			return true
		}
	case "makeSpec":
		if fn, ok := val.(func(ctx *core.Context) (*core.Spec, error)); ok {
			u.MakeSpec = fn
			return true
		}
	case "makeUrl":
		if fn, ok := val.(func(ctx *core.Context) (string, error)); ok {
			u.MakeUrl = fn
			return true
		}
	case "param":
		if fn, ok := val.(func(ctx *core.Context, paramdef any) any); ok {
			u.Param = fn
			return true
		}
	case "prepareAuth":
		if fn, ok := val.(func(ctx *core.Context) (*core.Spec, error)); ok {
			u.PrepareAuth = fn
			return true
		}
	case "prepareBody":
		if fn, ok := val.(func(ctx *core.Context) any); ok {
			u.PrepareBody = fn
			return true
		}
	case "prepareHeaders":
		if fn, ok := val.(func(ctx *core.Context) map[string]any); ok {
			u.PrepareHeaders = fn
			return true
		}
	case "prepareMethod":
		if fn, ok := val.(func(ctx *core.Context) string); ok {
			u.PrepareMethod = fn
			return true
		}
	case "prepareParams":
		if fn, ok := val.(func(ctx *core.Context) map[string]any); ok {
			u.PrepareParams = fn
			return true
		}
	case "preparePath":
		if fn, ok := val.(func(ctx *core.Context) string); ok {
			u.PreparePath = fn
			return true
		}
	case "prepareQuery":
		if fn, ok := val.(func(ctx *core.Context) map[string]any); ok {
			u.PrepareQuery = fn
			return true
		}
	case "graphqlBody":
		if fn, ok := val.(func(ctx *core.Context) any); ok {
			u.GraphqlBody = fn
			return true
		}
	case "graphqlErrors":
		if fn, ok := val.(func(ctx *core.Context) bool); ok {
			u.GraphqlErrors = fn
			return true
		}
	case "resultBasic":
		if fn, ok := val.(func(ctx *core.Context) *core.Result); ok {
			u.ResultBasic = fn
			return true
		}
	case "resultBody":
		if fn, ok := val.(func(ctx *core.Context) *core.Result); ok {
			u.ResultBody = fn
			return true
		}
	case "resultHeaders":
		if fn, ok := val.(func(ctx *core.Context) *core.Result); ok {
			u.ResultHeaders = fn
			return true
		}
	case "transformRequest":
		if fn, ok := val.(func(ctx *core.Context) any); ok {
			u.TransformRequest = fn
			return true
		}
	case "transformResponse":
		if fn, ok := val.(func(ctx *core.Context) any); ok {
			u.TransformResponse = fn
			return true
		}
	}
	return false
}
