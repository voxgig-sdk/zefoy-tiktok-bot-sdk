-- ZefoyTiktokBot SDK utility: param

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

local function param_util(ctx, paramdef)
  local point = ctx.point
  local spec = ctx.spec
  local match = ctx.match
  local reqmatch = ctx.reqmatch
  local data = ctx.data
  local reqdata = ctx.reqdata

  local pt = vs.typify(paramdef)
  local key = ""

  if (vs.T_string & pt) > 0 then
    key = paramdef
  else
    local k = vs.getprop(paramdef, "name")
    if type(k) == "string" then
      key = k
    end
  end

  local akey = ""
  if point ~= nil then
    local alias = helpers.to_map(vs.getprop(point, "alias"))
    if alias ~= nil then
      local ak = vs.getprop(alias, key)
      if type(ak) == "string" then
        akey = ak
      end
    end
  end

  local val = vs.getprop(reqmatch, key)

  if val == nil then
    val = vs.getprop(match, key)
  end

  if val == nil and akey ~= "" then
    if spec ~= nil then
      spec.alias[akey] = key
    end
    val = vs.getprop(reqmatch, akey)
  end

  if val == nil then
    val = vs.getprop(reqdata, key)
  end

  if val == nil then
    val = vs.getprop(data, key)
  end

  if val == nil and akey ~= "" then
    val = vs.getprop(reqdata, akey)
    if val == nil then
      val = vs.getprop(data, akey)
    end
  end

  return val
end

return param_util
