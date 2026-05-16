-- ZefoyTiktokBot SDK utility: prepare_path

local vs = require("utility.struct.struct")

local function prepare_path_util(ctx)
  local point = ctx.point

  local parts = {}
  if point ~= nil then
    local p = vs.getprop(point, "parts")
    if type(p) == "table" then
      parts = p
    end
  end

  return vs.join(parts, "/", true)
end

return prepare_path_util
