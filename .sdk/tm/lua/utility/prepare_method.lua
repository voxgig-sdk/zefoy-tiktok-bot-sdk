-- ZefoyTiktokBot SDK utility: prepare_method

local vs = require("utility.struct.struct")

local METHOD_MAP = {
  create = "POST",
  update = "PUT",
  load = "GET",
  list = "GET",
  remove = "DELETE",
  patch = "PATCH",
}

local function prepare_method_util(ctx)
  local opname = ctx.op.name

  -- The API definition is authoritative: a POST-only or PATCH-based API
  -- exposes `update` as POST or PATCH, not the PUT the op name implies.
  -- Only fall back to the op-name convention when the point has no method.
  local method = vs.getprop(ctx.point, "method")
  if "string" == type(method) and "" ~= method then
    return string.upper(method)
  end

  return METHOD_MAP[opname] or "GET"
end

return prepare_method_util
