-- ZefoyTiktokBot SDK rbac feature
--
-- Client-side role/permission enforcement. Before an operation resolves
-- its endpoint (PrePoint), the required permission for that entity+op is
-- checked against the permissions the client holds; a disallowed call is
-- short-circuited with an `rbac_denied` error and never touches the
-- network. Required permissions come from `rules` (keyed by
-- `<entity>.<op>`, `<op>`, or `*`); the default when no rule matches is
-- controlled by `deny` (default: allow when unspecified). Held
-- permissions are the `permissions` list (a `*` grants everything).
--
-- Short-circuit mechanism: the denial error is placed in
-- `ctx.out["point"]`; `make_point` recognises an SDK error there and
-- returns it as the operation error before any endpoint work happens.

local BaseFeature = require("feature.base_feature")

local RbacFeature = {}
RbacFeature.__index = RbacFeature
setmetatable(RbacFeature, { __index = BaseFeature })


function RbacFeature.new()
  local self = setmetatable(BaseFeature.new(), RbacFeature)
  self.version = "0.0.1"
  self.name = "rbac"
  self.active = true
  self.client = nil
  self.options = nil
  self.granted = {}
  return self
end


function RbacFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.granted = {}
  local perms = self.options["permissions"] or {}
  for _, p in ipairs(perms) do
    self.granted[p] = true
  end
end


function RbacFeature:PrePoint(ctx)
  if not self.active then
    return
  end

  local required = self:_required(ctx)
  if required == nil then
    -- No rule: honour the default policy.
    if self.options["deny"] == true then
      return self:_reject(ctx, "<default-deny>")
    end
    return
  end

  if self.granted["*"] or self.granted[required] then
    self:_track(ctx, required, true)
    return
  end

  return self:_reject(ctx, required)
end


function RbacFeature:_required(ctx)
  local rules = self.options["rules"] or {}

  local entity = ""
  if ctx.entity ~= nil then
    if type(ctx.entity.get_name) == "function" then
      entity = ctx.entity:get_name()
    elseif type(ctx.entity.name) == "string" then
      entity = ctx.entity.name
    end
  end
  if entity == "" and ctx.op ~= nil and type(ctx.op.entity) == "string" then
    entity = ctx.op.entity
  end

  local opname = ""
  if ctx.op ~= nil and type(ctx.op.name) == "string" then
    opname = ctx.op.name
  end

  if rules[entity .. "." .. opname] ~= nil then
    return rules[entity .. "." .. opname]
  end
  if rules[opname] ~= nil then
    return rules[opname]
  end
  if rules["*"] ~= nil then
    return rules["*"]
  end
  return nil
end


function RbacFeature:_reject(ctx, required)
  self:_track(ctx, required, false)
  local opname = "?"
  if ctx.op ~= nil and type(ctx.op.name) == "string" and ctx.op.name ~= "" then
    opname = ctx.op.name
  end
  local err = ctx:make_error("rbac_denied",
    'Permission "' .. required .. '" required for operation "' .. opname .. '"')
  -- Short-circuit endpoint resolution; the pipeline surfaces this error.
  ctx.out["point"] = err
  return err
end


function RbacFeature:_track(ctx, required, allowed)
  local client = self.client
  if client._rbac == nil then
    client._rbac = { allowed = 0, denied = 0, last = nil }
  end
  if allowed then
    client._rbac.allowed = client._rbac.allowed + 1
  else
    client._rbac.denied = client._rbac.denied + 1
  end
  client._rbac.last = {
    required = required,
    allowed = allowed,
    op = ctx.op ~= nil and ctx.op.name or nil,
  }
end


return RbacFeature
