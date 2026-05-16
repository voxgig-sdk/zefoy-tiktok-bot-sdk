-- ZefoyTiktokBot SDK utility: prepare_method

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
  return METHOD_MAP[opname] or "GET"
end

return prepare_method_util
