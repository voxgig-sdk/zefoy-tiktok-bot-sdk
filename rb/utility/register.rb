# ZefoyTiktokBot SDK utility registration
require_relative '../core/utility_type'
require_relative 'clean'
require_relative 'done'
require_relative 'make_error'
require_relative 'feature_add'
require_relative 'feature_hook'
require_relative 'feature_init'
require_relative 'fetcher'
require_relative 'make_fetch_def'
require_relative 'make_context'
require_relative 'make_options'
require_relative 'make_request'
require_relative 'make_response'
require_relative 'make_result'
require_relative 'make_point'
require_relative 'make_spec'
require_relative 'make_url'
require_relative 'param'
require_relative 'prepare_auth'
require_relative 'prepare_body'
require_relative 'prepare_headers'
require_relative 'prepare_method'
require_relative 'prepare_params'
require_relative 'prepare_path'
require_relative 'prepare_query'
require_relative 'graphql'
require_relative 'result_basic'
require_relative 'result_body'
require_relative 'result_headers'
require_relative 'transform_request'
require_relative 'transform_response'

ZefoyTiktokBotUtility.registrar = ->(u) {
  u.clean = ZefoyTiktokBotUtilities::Clean
  u.done = ZefoyTiktokBotUtilities::Done
  u.make_error = ZefoyTiktokBotUtilities::MakeError
  u.feature_add = ZefoyTiktokBotUtilities::FeatureAdd
  u.feature_hook = ZefoyTiktokBotUtilities::FeatureHook
  u.feature_init = ZefoyTiktokBotUtilities::FeatureInit
  u.fetcher = ZefoyTiktokBotUtilities::Fetcher
  u.make_fetch_def = ZefoyTiktokBotUtilities::MakeFetchDef
  u.make_context = ZefoyTiktokBotUtilities::MakeContext
  u.make_options = ZefoyTiktokBotUtilities::MakeOptions
  u.make_request = ZefoyTiktokBotUtilities::MakeRequest
  u.make_response = ZefoyTiktokBotUtilities::MakeResponse
  u.make_result = ZefoyTiktokBotUtilities::MakeResult
  u.make_point = ZefoyTiktokBotUtilities::MakePoint
  u.make_spec = ZefoyTiktokBotUtilities::MakeSpec
  u.make_url = ZefoyTiktokBotUtilities::MakeUrl
  u.param = ZefoyTiktokBotUtilities::Param
  u.prepare_auth = ZefoyTiktokBotUtilities::PrepareAuth
  u.prepare_body = ZefoyTiktokBotUtilities::PrepareBody
  u.prepare_headers = ZefoyTiktokBotUtilities::PrepareHeaders
  u.prepare_method = ZefoyTiktokBotUtilities::PrepareMethod
  u.prepare_params = ZefoyTiktokBotUtilities::PrepareParams
  u.prepare_path = ZefoyTiktokBotUtilities::PreparePath
  u.prepare_query = ZefoyTiktokBotUtilities::PrepareQuery
  u.graphql_body = ZefoyTiktokBotUtilities::GraphqlBody
  u.graphql_errors = ZefoyTiktokBotUtilities::GraphqlErrors
  u.result_basic = ZefoyTiktokBotUtilities::ResultBasic
  u.result_body = ZefoyTiktokBotUtilities::ResultBody
  u.result_headers = ZefoyTiktokBotUtilities::ResultHeaders
  u.transform_request = ZefoyTiktokBotUtilities::TransformRequest
  u.transform_response = ZefoyTiktokBotUtilities::TransformResponse
}
