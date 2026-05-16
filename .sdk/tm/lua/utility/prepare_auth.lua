-- ZefoyTiktokBot SDK utility: prepare_auth

local vs = require("utility.struct.struct")

local HEADER_AUTH = "authorization"
local OPTION_APIKEY = "apikey"
local NOT_FOUND = "__NOTFOUND__"

local function prepare_auth_util(ctx)
  local spec = ctx.spec
  if spec == nil then
    return nil, ctx:make_error("auth_no_spec",
      "Expected context spec property to be defined.")
  end

  local headers = spec.headers
  local options = ctx.client:options_map()

  -- Public APIs that need no auth omit the options.auth block entirely.
  if options.auth == nil then
    headers[HEADER_AUTH] = nil
    return spec, nil
  end

  local apikey = vs.getprop(options, OPTION_APIKEY, NOT_FOUND)

  if apikey == nil
    or (type(apikey) == "string" and (apikey == NOT_FOUND or apikey == ""))
  then
    headers[HEADER_AUTH] = nil
  else
    local auth_prefix = ""
    local ap = vs.getpath(options, "auth.prefix")
    if type(ap) == "string" then
      auth_prefix = ap
    end
    local apikey_val = ""
    if type(apikey) == "string" then
      apikey_val = apikey
    end
    headers[HEADER_AUTH] = auth_prefix .. " " .. apikey_val
  end

  return spec, nil
end

return prepare_auth_util
