

import { clean } from './CleanUtility'
import { done } from './DoneUtility'
import { makeError } from './MakeErrorUtility'
import { featureAdd } from './FeatureAddUtility'
import { featureHook } from './FeatureHookUtility'
import { featureInit } from './FeatureInitUtility'
import { fetcher } from './FetcherUtility'
import { makeFetchDef } from './MakeFetchDefUtility'
import { makeContext } from './MakeContextUtility'
import { makeOptions } from './MakeOptionsUtility'
import { makeRequest } from './MakeRequestUtility'
import { makeResponse } from './MakeResponseUtility'
import { makeResult } from './MakeResultUtility'
import { makePoint } from './MakePointUtility'
import { makeSpec } from './MakeSpecUtility'
import { makeUrl } from './MakeUrlUtility'
import { param } from './ParamUtility'
import { prepareAuth } from './PrepareAuthUtility'
import { prepareBody } from './PrepareBodyUtility'
import { prepareHeaders } from './PrepareHeadersUtility'
import { prepareMethod } from './PrepareMethodUtility'
import { prepareParams } from './PrepareParamsUtility'
import { preparePath } from './PreparePathUtility'
import { prepareQuery } from './PrepareQueryUtility'
import { resultBasic } from './ResultBasicUtility'
import { resultBody } from './ResultBodyUtility'
import { resultHeaders } from './ResultHeadersUtility'
import { transformRequest } from './TransformRequestUtility'
import { transformResponse } from './TransformResponseUtility'

import { StructUtility } from './StructUtility'


class Utility {

  clean = clean
  done = done
  makeError = makeError
  featureAdd = featureAdd
  featureHook = featureHook
  featureInit = featureInit
  fetcher = fetcher
  makeFetchDef = makeFetchDef
  makeContext = makeContext
  makeOptions = makeOptions
  makeRequest = makeRequest
  makeResponse = makeResponse
  makeResult = makeResult
  makePoint = makePoint
  makeSpec = makeSpec
  makeUrl = makeUrl
  param = param
  prepareAuth = prepareAuth
  prepareBody = prepareBody
  prepareHeaders = prepareHeaders
  prepareMethod = prepareMethod
  prepareParams = prepareParams
  preparePath = preparePath
  prepareQuery = prepareQuery
  resultBasic = resultBasic
  resultBody = resultBody
  resultHeaders = resultHeaders
  transformRequest = transformRequest
  transformResponse = transformResponse

  struct = new StructUtility()
}


export {
  Utility
}

