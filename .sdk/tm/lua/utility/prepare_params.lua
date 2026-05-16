-- ZefoyTiktokBot SDK utility: prepare_params

local vs = require("utility.struct.struct")

local function prepare_params_util(ctx)
  local utility = ctx.utility
  local point = ctx.point

  local params = {}
  if point ~= nil then
    local args = vs.getprop(point, "args")
    if type(args) == "table" then
      local p = vs.getprop(args, "params")
      if type(p) == "table" then
        params = p
      end
    end
  end

  local out = {}
  for _, pd in ipairs(params) do
    local val = utility.param(ctx, pd)
    if val ~= nil then
      if type(pd) == "table" then
        local name = vs.getprop(pd, "name")
        if type(name) == "string" and name ~= "" then
          out[name] = val
        end
      end
    end
  end

  return out
end

return prepare_params_util
