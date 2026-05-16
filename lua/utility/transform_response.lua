-- ZefoyTiktokBot SDK utility: transform_response

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

local function transform_response_util(ctx)
  local spec = ctx.spec
  local result = ctx.result
  local point = ctx.point

  if spec ~= nil then
    spec.step = "resform"
  end

  if result == nil or not result.ok then
    return nil
  end

  local transform = helpers.to_map(vs.getprop(point, "transform"))
  if transform == nil then
    return nil
  end

  local resform = vs.getprop(transform, "res")
  if resform == nil then
    return nil
  end

  local resdata = vs.transform({
    ok = result.ok,
    status = result.status,
    statusText = result.status_text,
    headers = result.headers,
    body = result.body,
    err = result.err,
    resdata = result.resdata,
    resmatch = result.resmatch,
  }, resform)

  result.resdata = resdata
  return resdata
end

return transform_response_util
