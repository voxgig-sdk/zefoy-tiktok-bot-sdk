-- ZefoyTiktokBot SDK utility registration

local Utility = require("core.utility_type")

local clean = require("utility.clean")
local done = require("utility.done")
local make_error = require("utility.make_error")
local feature_add = require("utility.feature_add")
local feature_hook = require("utility.feature_hook")
local feature_init = require("utility.feature_init")
local fetcher = require("utility.fetcher")
local make_fetch_def = require("utility.make_fetch_def")
local make_context = require("utility.make_context")
local make_options = require("utility.make_options")
local make_request = require("utility.make_request")
local make_response = require("utility.make_response")
local make_result = require("utility.make_result")
local make_point = require("utility.make_point")
local make_spec = require("utility.make_spec")
local make_url = require("utility.make_url")
local param = require("utility.param")
local prepare_auth = require("utility.prepare_auth")
local prepare_body = require("utility.prepare_body")
local prepare_headers = require("utility.prepare_headers")
local prepare_method = require("utility.prepare_method")
local prepare_params = require("utility.prepare_params")
local prepare_path = require("utility.prepare_path")
local prepare_query = require("utility.prepare_query")
local graphql = require("utility.graphql")
local result_basic = require("utility.result_basic")
local result_body = require("utility.result_body")
local result_headers = require("utility.result_headers")
local transform_request = require("utility.transform_request")
local transform_response = require("utility.transform_response")


local function register_all(u)
  u.clean = clean
  u.done = done
  u.make_error = make_error
  u.feature_add = feature_add
  u.feature_hook = feature_hook
  u.feature_init = feature_init
  u.fetcher = fetcher
  u.make_fetch_def = make_fetch_def
  u.make_context = make_context
  u.make_options = make_options
  u.make_request = make_request
  u.make_response = make_response
  u.make_result = make_result
  u.make_point = make_point
  u.make_spec = make_spec
  u.make_url = make_url
  u.param = param
  u.prepare_auth = prepare_auth
  u.prepare_body = prepare_body
  u.prepare_headers = prepare_headers
  u.prepare_method = prepare_method
  u.prepare_params = prepare_params
  u.prepare_path = prepare_path
  u.prepare_query = prepare_query
  u.graphql_body = graphql.body
  u.graphql_errors = graphql.errors
  u.result_basic = result_basic
  u.result_body = result_body
  u.result_headers = result_headers
  u.transform_request = transform_request
  u.transform_response = transform_response
end


Utility._registrar = register_all

return register_all
