-- ZefoyTiktokBot SDK telemetry feature
--
-- Distributed-tracing telemetry. Opens a span per operation (PrePoint),
-- propagates trace context to the server as W3C `traceparent` plus
-- `X-Trace-Id` / `X-Span-Id` headers (PreRequest), and closes the span on
-- completion (PreDone) or failure (PreUnexpected) — exactly once per
-- operation. Finished spans are kept on `client._telemetry.spans`; an
-- `exporter` callback, when provided, is invoked with each finished span.
-- Trace/span id generation (`idgen`) and the clock (`now`) are injectable
-- for deterministic tests.
--
-- Note: `end` is a Lua keyword, so the span close time is stored under the
-- string key `span["end"]`.

local BaseFeature = require("feature.base_feature")

local TelemetryFeature = {}
TelemetryFeature.__index = TelemetryFeature
setmetatable(TelemetryFeature, { __index = BaseFeature })


function TelemetryFeature.new()
  local self = setmetatable(BaseFeature.new(), TelemetryFeature)
  self.version = "0.0.1"
  self.name = "telemetry"
  self.active = true
  self.client = nil
  self.options = nil
  -- Weak keys: an abandoned context must not leak its open span.
  self.spans = setmetatable({}, { __mode = "k" })
  self.seq = 0
  return self
end


function TelemetryFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.spans = setmetatable({}, { __mode = "k" })
  self.seq = 0

  if not self.active then
    return
  end

  local client = self.client
  if client._telemetry == nil then
    client._telemetry = { spans = {}, active = 0 }
  end
end


function TelemetryFeature:PrePoint(ctx)
  if not self.active then
    return
  end
  local span = {
    traceId = self:_id("trace"),
    spanId = self:_id("span"),
    name = ((ctx.op ~= nil and ctx.op.entity) or "_") .. "." ..
      ((ctx.op ~= nil and ctx.op.name) or "_"),
    start = self:_now(),
  }
  self.spans[ctx] = span
  local client = self.client
  client._telemetry.active = client._telemetry.active + 1
end


function TelemetryFeature:PreRequest(ctx)
  if not self.active then
    return
  end
  local span = self.spans[ctx]
  local spec = ctx.spec
  if span == nil or spec == nil then
    return
  end
  if spec.headers == nil then
    spec.headers = {}
  end
  local h = self.options["headers"] or {}
  spec.headers[h["trace"] or "X-Trace-Id"] = span.traceId
  spec.headers[h["span"] or "X-Span-Id"] = span.spanId
  spec.headers[h["parent"] or "traceparent"] =
    "00-" .. span.traceId .. "-" .. span.spanId .. "-01"
end


function TelemetryFeature:PreDone(ctx)
  if not self.active then
    return
  end
  local ok = ctx.result ~= nil and ctx.result.ok ~= false and ctx.result.err == nil
  self:_close(ctx, ok)
end


function TelemetryFeature:PreUnexpected(ctx)
  if not self.active then
    return
  end
  self:_close(ctx, false)
end


function TelemetryFeature:_close(ctx, ok)
  -- Close once per operation; a PreDone followed by a pipeline error
  -- (non-2xx) fires PreUnexpected too, which then finds no open span.
  local span = self.spans[ctx]
  if span == nil then
    return
  end
  self.spans[ctx] = nil
  span["end"] = self:_now()
  span.durationMs = math.max(0, span["end"] - span.start)
  span.ok = ok

  local client = self.client
  client._telemetry.active = client._telemetry.active - 1
  table.insert(client._telemetry.spans, span)

  local exporter = self.options["exporter"]
  if type(exporter) == "function" then
    pcall(exporter, span)
  end
end


function TelemetryFeature:_id(kind)
  local idgen = self.options["idgen"]
  if type(idgen) == "function" then
    return idgen(kind)
  end
  -- Deterministic-ish sequential id; unique within a client instance.
  self.seq = self.seq + 1
  local n = string.format("%04x", self.seq)
  local prefix = kind == "trace" and "t" or "s"
  return prefix .. n .. string.rep("0", 12)
end


function TelemetryFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


return TelemetryFeature
