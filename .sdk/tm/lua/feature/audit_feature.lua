-- ZefoyTiktokBot SDK audit feature
--
-- Audit trail. Emits one structured record per operation — who (actor),
-- what (entity + op), the outcome, and a correlation id — suitable for
-- compliance logging. Records accumulate on `client._audit.records`
-- (bounded by `max`, default 1000) and, when a `sink` callback is
-- supplied, are also pushed to it (e.g. to forward to a SIEM). The actor
-- resolves per call as `ctrl.actor` > `options.actor` > 'anonymous'.
-- Emitted exactly once per operation (a PreDone followed by a pipeline
-- error must not double-log). Timestamps use the injectable `now` clock
-- so tests stay deterministic.

local BaseFeature = require("feature.base_feature")

local AuditFeature = {}
AuditFeature.__index = AuditFeature
setmetatable(AuditFeature, { __index = BaseFeature })


function AuditFeature.new()
  local self = setmetatable(BaseFeature.new(), AuditFeature)
  self.version = "0.0.1"
  self.name = "audit"
  self.active = true
  self.client = nil
  self.options = nil
  self.seq = 0
  -- Weak keys: contexts already emitted must not be retained.
  self.seen = setmetatable({}, { __mode = "k" })
  return self
end


function AuditFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.seq = 0
  self.seen = setmetatable({}, { __mode = "k" })

  if not self.active then
    return
  end

  local client = self.client
  if client._audit == nil then
    client._audit = { records = {} }
  end
end


function AuditFeature:PreDone(ctx)
  if not self.active then
    return
  end
  -- Outcome reflects the actual result; a non-2xx reaches PreDone before
  -- the pipeline surfaces the error.
  local ok = ctx.result ~= nil and ctx.result.ok ~= false and ctx.result.err == nil
  self:_emit(ctx, ok and "ok" or "error")
end


function AuditFeature:PreUnexpected(ctx)
  if not self.active then
    return
  end
  self:_emit(ctx, "error")
end


function AuditFeature:_emit(ctx, outcome)
  -- One record per operation (PreDone + a following PreUnexpected on a
  -- non-2xx must not double-log).
  if self.seen[ctx] then
    return
  end
  self.seen[ctx] = true
  self.seq = self.seq + 1

  local actor = nil
  if ctx.ctrl ~= nil and ctx.ctrl.actor ~= nil then
    actor = ctx.ctrl.actor
  end
  if actor == nil then
    actor = self.options["actor"]
  end
  if actor == nil then
    actor = "anonymous"
  end

  local record = {
    seq = self.seq,
    ts = self:_now(),
    actor = actor,
    entity = (ctx.op ~= nil and ctx.op.entity) or "_",
    op = (ctx.op ~= nil and ctx.op.name) or "_",
    outcome = outcome,
    status = ctx.result ~= nil and ctx.result.status or nil,
    correlationId = ctx.id,
  }

  local client = self.client
  local recs = client._audit.records
  table.insert(recs, record)
  local max = self.options["max"] == nil and 1000 or self.options["max"]
  while #recs > max do
    table.remove(recs, 1)
  end

  local sink = self.options["sink"]
  if type(sink) == "function" then
    pcall(sink, record)
  end
end


function AuditFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


return AuditFeature
