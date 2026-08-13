-- ZefoyTiktokBot SDK utility: make_spec

local vs = require("utility.struct.struct")
local graphql = require("utility.graphql")
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

  if "graphql" == vs.getprop(ctx.point, "kind") then
    -- GraphQL addresses one endpoint: no path parts, no query string, and
    -- the body carries the operation. prepare_body is skipped deliberately
    -- — it only emits a body for data-input ops, whereas every GraphQL op
    -- posts one, including load/list/remove.
    ctx.spec.body = utility.graphql_body(ctx)
    ctx.spec.path = ""
    -- prepare_query already copied the op's match arguments into the query
    -- string. Those same values are bound as operation variables, so
    -- leaving them would send /graphql?id=i1.
    ctx.spec.query = {}
    ctx.spec.headers["content-type"] = graphql.CONTENT_TYPE
  else
    ctx.spec.body = utility.prepare_body(ctx)
    ctx.spec.path = utility.prepare_path(ctx)
  end

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
