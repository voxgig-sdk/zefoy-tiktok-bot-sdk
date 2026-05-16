-- ZefoyTiktokBot SDK utility: prepare_headers

local vs = require("utility.struct.struct")

local function prepare_headers_util(ctx)
  local options = ctx.client:options_map()
  local headers = vs.getprop(options, "headers")

  if headers == nil then
    return {}
  end

  local out = vs.clone(headers)
  if type(out) == "table" then
    return out
  end
  return {}
end

return prepare_headers_util
