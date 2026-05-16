-- ZefoyTiktokBot SDK utility type

local Utility = {}
Utility.__index = Utility


function Utility.new()
  local self = setmetatable({}, Utility)
  self.custom = {}

  -- All utility functions are set by the register module
  self.clean = nil
  self.done = nil
  self.make_error = nil
  self.feature_add = nil
  self.feature_hook = nil
  self.feature_init = nil
  self.fetcher = nil
  self.make_fetch_def = nil
  self.make_context = nil
  self.make_options = nil
  self.make_request = nil
  self.make_response = nil
  self.make_result = nil
  self.make_point = nil
  self.make_spec = nil
  self.make_url = nil
  self.param = nil
  self.prepare_auth = nil
  self.prepare_body = nil
  self.prepare_headers = nil
  self.prepare_method = nil
  self.prepare_params = nil
  self.prepare_path = nil
  self.prepare_query = nil
  self.result_basic = nil
  self.result_body = nil
  self.result_headers = nil
  self.transform_request = nil
  self.transform_response = nil

  -- Let the registrar fill in all functions
  if Utility._registrar ~= nil then
    Utility._registrar(self)
  end

  return self
end


function Utility.copy(src)
  local u = Utility.new()
  u.clean = src.clean
  u.done = src.done
  u.make_error = src.make_error
  u.feature_add = src.feature_add
  u.feature_hook = src.feature_hook
  u.feature_init = src.feature_init
  u.fetcher = src.fetcher
  u.make_fetch_def = src.make_fetch_def
  u.make_context = src.make_context
  u.make_options = src.make_options
  u.make_request = src.make_request
  u.make_response = src.make_response
  u.make_result = src.make_result
  u.make_point = src.make_point
  u.make_spec = src.make_spec
  u.make_url = src.make_url
  u.param = src.param
  u.prepare_auth = src.prepare_auth
  u.prepare_body = src.prepare_body
  u.prepare_headers = src.prepare_headers
  u.prepare_method = src.prepare_method
  u.prepare_params = src.prepare_params
  u.prepare_path = src.prepare_path
  u.prepare_query = src.prepare_query
  u.result_basic = src.result_basic
  u.result_body = src.result_body
  u.result_headers = src.result_headers
  u.transform_request = src.transform_request
  u.transform_response = src.transform_response
  u.custom = {}
  for k, v in pairs(src.custom) do
    u.custom[k] = v
  end
  return u
end


return Utility
