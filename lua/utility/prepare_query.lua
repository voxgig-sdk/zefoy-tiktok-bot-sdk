-- ZefoyTiktokBot SDK utility: prepare_query

local vs = require("utility.struct.struct")

local function contains_param(params, s)
  for _, v in ipairs(params) do
    if type(v) == "string" and v == s then
      return true
    end
  end
  return false
end

local function prepare_query_util(ctx)
  local point = ctx.point
  local reqmatch = ctx.reqmatch or {}

  local params = {}
  if point ~= nil then
    local p = vs.getprop(point, "params")
    if type(p) == "table" then
      params = p
    end
  end

  local out = {}
  local reqmatch_items = vs.items(reqmatch)
  if reqmatch_items ~= nil then
    for _, item in ipairs(reqmatch_items) do
      local key = item[1]
      local val = item[2]
      if val ~= nil and type(key) == "string" and not contains_param(params, key) then
        out[key] = val
      end
    end
  end

  return out
end

return prepare_query_util
