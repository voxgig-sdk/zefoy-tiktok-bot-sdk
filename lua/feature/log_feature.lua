-- ZefoyTiktokBot SDK log feature

local BaseFeature = require("feature.base_feature")

local LogFeature = {}
LogFeature.__index = LogFeature
setmetatable(LogFeature, { __index = BaseFeature })


function LogFeature.new()
  local self = setmetatable(BaseFeature.new(), LogFeature)
  self.version = "0.0.1"
  self.name = "log"
  self.active = true
  self.client = nil
  self.options = nil
  self.logger = nil
  return self
end


function LogFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  if self.active then
    if type(options["logger"]) == "table" then
      self.logger = options["logger"]
    else
      self.logger = {
        info = function(_, msg, ...) io.stderr:write("[INFO] " .. msg .. "\n") end,
        debug = function(_, msg, ...) io.stderr:write("[DEBUG] " .. msg .. "\n") end,
        warn = function(_, msg, ...) io.stderr:write("[WARN] " .. msg .. "\n") end,
        error = function(_, msg, ...) io.stderr:write("[ERROR] " .. msg .. "\n") end,
      }
    end
  end
end


function LogFeature:_loghook(hook, ctx, level)
  if self.logger == nil then
    return
  end

  level = level or "info"
  local opname = ""
  if ctx.op ~= nil then
    opname = ctx.op.name
  end

  local msg = "hook=" .. hook .. " op=" .. opname

  local log_fn = self.logger[level]
  if type(log_fn) == "function" then
    log_fn(self.logger, msg)
  end
end


function LogFeature:PostConstruct(ctx) self:_loghook("PostConstruct", ctx) end
function LogFeature:PostConstructEntity(ctx) self:_loghook("PostConstructEntity", ctx) end
function LogFeature:SetData(ctx) self:_loghook("SetData", ctx) end
function LogFeature:GetData(ctx) self:_loghook("GetData", ctx) end
function LogFeature:SetMatch(ctx) self:_loghook("SetMatch", ctx) end
function LogFeature:GetMatch(ctx) self:_loghook("GetMatch", ctx) end
function LogFeature:PrePoint(ctx) self:_loghook("PrePoint", ctx) end
function LogFeature:PreSpec(ctx) self:_loghook("PreSpec", ctx) end
function LogFeature:PreRequest(ctx) self:_loghook("PreRequest", ctx) end
function LogFeature:PreResponse(ctx) self:_loghook("PreResponse", ctx) end
function LogFeature:PreResult(ctx) self:_loghook("PreResult", ctx) end


return LogFeature
