-- ZefoyTiktokBot SDK utility: transform_request

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

local function transform_request_util(ctx)
  local spec = ctx.spec
  local point = ctx.point

  if spec ~= nil then
    spec.step = "reqform"
  end

  local transform = helpers.to_map(vs.getprop(point, "transform"))
  if transform == nil then
    return ctx.reqdata
  end

  local reqform = vs.getprop(transform, "req")
  if reqform == nil then
    return ctx.reqdata
  end

  local reqdata = vs.transform({
    reqdata = ctx.reqdata,
  }, reqform)

  return reqdata
end

return transform_request_util
