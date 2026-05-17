-- ZefoyTiktokBot SDK context

local vs = require("utility.struct.struct")
local Control = require("core.control")
local Operation = require("core.operation")
local Spec = require("core.spec")
local Result = require("core.result")
local Response = require("core.response")
local ZefoyTiktokBotError = require("core.error")
local helpers = require("core.helpers")

local Context = {}
Context.__index = Context


function Context.new(ctxmap, basectx)
  local self = setmetatable({}, Context)

  self.id = "C" .. tostring(math.random(10000000, 99999999))
  self.out = {}

  ctxmap = ctxmap or {}

  -- Client
  local c = helpers.get_ctx_prop(ctxmap, "client")
  if c ~= nil then
    self.client = c
  elseif basectx ~= nil then
    self.client = basectx.client
  end

  -- Utility
  local u = helpers.get_ctx_prop(ctxmap, "utility")
  if u ~= nil then
    self.utility = u
  elseif basectx ~= nil then
    self.utility = basectx.utility
  end

  -- Ctrl
  self.ctrl = Control.new()
  local ctrl_raw = helpers.get_ctx_prop(ctxmap, "ctrl")
  if type(ctrl_raw) == "table" then
    if ctrl_raw.throw_err ~= nil then
      self.ctrl.throw_err = ctrl_raw.throw_err
    elseif type(ctrl_raw["throw"]) == "boolean" then
      self.ctrl.throw_err = ctrl_raw["throw"]
    end
    if type(ctrl_raw.explain) == "table" then
      self.ctrl.explain = ctrl_raw.explain
    end
  elseif basectx ~= nil and basectx.ctrl ~= nil then
    self.ctrl = basectx.ctrl
  end

  -- Meta
  self.meta = {}
  local m = helpers.get_ctx_prop(ctxmap, "meta")
  if type(m) == "table" then
    self.meta = m
  elseif basectx ~= nil and basectx.meta ~= nil then
    self.meta = basectx.meta
  end

  -- Config
  local cfg = helpers.get_ctx_prop(ctxmap, "config")
  if type(cfg) == "table" then
    self.config = cfg
  elseif basectx ~= nil then
    self.config = basectx.config
  end

  -- Entopts
  local eo = helpers.get_ctx_prop(ctxmap, "entopts")
  if type(eo) == "table" then
    self.entopts = eo
  elseif basectx ~= nil then
    self.entopts = basectx.entopts
  end

  -- Options
  local o = helpers.get_ctx_prop(ctxmap, "options")
  if type(o) == "table" then
    self.options = o
  elseif basectx ~= nil then
    self.options = basectx.options
  end

  -- Entity
  local e = helpers.get_ctx_prop(ctxmap, "entity")
  if e ~= nil then
    self.entity = e
  elseif basectx ~= nil then
    self.entity = basectx.entity
  end

  -- Shared
  local s = helpers.get_ctx_prop(ctxmap, "shared")
  if type(s) == "table" then
    self.shared = s
  elseif basectx ~= nil then
    self.shared = basectx.shared
  end

  -- Opmap
  local om = helpers.get_ctx_prop(ctxmap, "opmap")
  if type(om) == "table" then
    self.opmap = om
  elseif basectx ~= nil then
    self.opmap = basectx.opmap
  end
  if self.opmap == nil then
    self.opmap = {}
  end

  -- Data
  self.data = helpers.to_map(helpers.get_ctx_prop(ctxmap, "data")) or {}
  self.reqdata = helpers.to_map(helpers.get_ctx_prop(ctxmap, "reqdata")) or {}
  self.match = helpers.to_map(helpers.get_ctx_prop(ctxmap, "match")) or {}
  self.reqmatch = helpers.to_map(helpers.get_ctx_prop(ctxmap, "reqmatch")) or {}

  -- Point
  local pt = helpers.get_ctx_prop(ctxmap, "point")
  if type(pt) == "table" then
    self.point = pt
  elseif basectx ~= nil then
    self.point = basectx.point
  end

  -- Spec
  local sp = helpers.get_ctx_prop(ctxmap, "spec")
  if sp ~= nil and getmetatable(sp) == Spec then
    self.spec = sp
  elseif basectx ~= nil then
    self.spec = basectx.spec
  end

  -- Result
  local r = helpers.get_ctx_prop(ctxmap, "result")
  if r ~= nil and getmetatable(r) == Result then
    self.result = r
  elseif basectx ~= nil then
    self.result = basectx.result
  end

  -- Response
  local rp = helpers.get_ctx_prop(ctxmap, "response")
  if rp ~= nil and getmetatable(rp) == Response then
    self.response = rp
  elseif basectx ~= nil then
    self.response = basectx.response
  end

  -- Resolve operation
  local opname = helpers.get_ctx_prop(ctxmap, "opname") or ""
  self.op = self:resolve_op(opname)

  return self
end


function Context:resolve_op(opname)
  -- Cache key is `<entity>:<opname>` so two entities with the same op
  -- (e.g. both have a "list") get distinct cached Operations. Keying
  -- on opname alone caused the first-resolved entity's points to be
  -- served to every subsequent entity's call.
  local entname = "_"
  if self.entity ~= nil and type(self.entity.get_name) == "function" then
    entname = self.entity:get_name()
  end
  local cache_key = entname .. ":" .. opname

  if self.opmap[cache_key] ~= nil then
    return self.opmap[cache_key]
  end

  if opname == "" then
    return Operation.new({})
  end

  local opcfg = vs.getpath(self.config, "entity." .. entname .. ".op." .. opname)

  local input = "match"
  if opname == "update" or opname == "create" then
    input = "data"
  end

  local points = {}
  if type(opcfg) == "table" then
    local t = vs.getprop(opcfg, "points")
    if type(t) == "table" then
      points = t
    end
  end

  local op = Operation.new({
    entity = entname,
    name = opname,
    input = input,
    points = points,
  })

  self.opmap[cache_key] = op
  return op
end


function Context:make_error(code, msg)
  return ZefoyTiktokBotError.new(code, msg, self)
end


return Context
