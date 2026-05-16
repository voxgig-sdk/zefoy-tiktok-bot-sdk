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
	u.ResultBasic = resultBasicUtil
	u.ResultBody = resultBodyUtil
	u.ResultHeaders = resultHeadersUtil
	u.TransformRequest = transformRequestUtil
	u.TransformResponse = transformResponseUtil
}
