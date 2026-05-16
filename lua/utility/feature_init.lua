-- ZefoyTiktokBot SDK utility: feature_init

local vs = require("utility.struct.struct")

local function feature_init_util(ctx, f)
  local fname = f:get_name()
  local fopts = {}

  if ctx.options ~= nil then
    local feature_opts = vs.getprop(ctx.options, "feature")
    if type(feature_opts) == "table" then
      local fo = vs.getprop(feature_opts, fname)
      if type(fo) == "table" then
        fopts = fo
      end
    end
  end

  if fopts["active"] == true then
    f:init(ctx, fopts)
  end
end

return feature_init_util
