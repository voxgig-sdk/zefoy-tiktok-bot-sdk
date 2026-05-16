-- ZefoyTiktokBot SDK utility: make_spec

local vs = require("utility.struct.struct")
local Spec = require("core.spec")

local function make_spec_util(ctx)
  if ctx.out["spec"] ~= nil then
    ctx.spec = ctx.out["spec"]
    return ctx.spec, nil
  end

  local point = ctx.point
  local options = ctx.options
  local utility = ctx.utility

  local base = ""
  local b = vs.getprop(options, "base")
  if type(b) == "string" then base = b end

  local prefix = ""
  local p = vs.getprop(options, "prefix")
  if type(p) == "string" then prefix = p end

  local suffix = ""
  local s = vs.getprop(options, "suffix")
  if type(s) == "string" then suffix = s end

  local parts = {}
  if point ~= nil then
    local pt = vs.getprop(point, "parts")
    if type(pt) == "table" then
      parts = pt
    end
  end

  ctx.spec = Spec.new({
    base = base,
    prefix = prefix,
    parts = parts,
    suffix = suffix,
    step = "start",
  })

  ctx.spec.method = utility.prepare_method(ctx)

  local allow_method = vs.getpath(options, "allow.method") or ""
  if type(allow_method) == "string" and not string.find(allow_method, ctx.spec.method, 1, true) then
    return nil, ctx:make_error("spec_method_allow",
      'Method "' .. ctx.spec.method ..
      '" not allowed by SDK option allow.method value: "' .. allow_method .. '"')
  end

  ctx.spec.params = utility.prepare_params(ctx)
  ctx.spec.query = utility.prepare_query(ctx)
  ctx.spec.headers = utility.prepare_headers(ctx)
  ctx.spec.body = utility.prepare_body(ctx)
  ctx.spec.path = utility.prepare_path(ctx)

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["spec"] = ctx.spec
  end

  local spec, err = utility.prepare_auth(ctx)
  if err ~= nil then
    return nil, err
  end

  ctx.spec = spec
  return spec, nil
end

return make_spec_util
