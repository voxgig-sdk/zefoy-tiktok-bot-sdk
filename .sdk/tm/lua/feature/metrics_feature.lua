-- ZefoyTiktokBot SDK metrics feature
--
-- Statistics capture. Records per-operation counters and latency for
-- every call: totals plus a breakdown keyed by `<entity>.<op>`. Timing
-- starts at endpoint resolution (PrePoint) and stops when the call
-- completes (PreDone) or fails unexpectedly (PreUnexpected). Each
-- operation is recorded exactly once: the start marker is consumed on the
-- first close, making a following duplicate hook a no-op. Aggregates live
-- on `client._metrics`. The clock is injectable (`now`) for deterministic
-- tests.

local BaseFeature = require("feature.base_feature")

local MetricsFeature = {}
MetricsFeature.__index = MetricsFeature
setmetatable(MetricsFeature, { __index = BaseFeature })


function MetricsFeature.new()
  local self = setmetatable(BaseFeature.new(), MetricsFeature)
  self.version = "0.0.1"
  self.name = "metrics"
  self.active = true
  self.client = nil
  self.options = nil
  -- Weak keys: an abandoned context must not leak its start marker.
  self.starts = setmetatable({}, { __mode = "k" })
  return self
end


function MetricsFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.starts = setmetatable({}, { __mode = "k" })

  if not self.active then
    return
  end

  local client = self.client
  if client._metrics == nil then
    client._metrics = {
      total = { count = 0, ok = 0, err = 0, totalMs = 0, maxMs = 0 },
      ops = {},
    }
  end
end


function MetricsFeature:PrePoint(ctx)
  if not self.active then
    return
  end
  self.starts[ctx] = self:_now()
end


function MetricsFeature:PreDone(ctx)
  if not self.active then
    return
  end
  -- Classify by the actual result: a 4xx/5xx that flows through still
  -- reaches PreDone before the pipeline surfaces the error.
  local ok = ctx.result ~= nil and ctx.result.ok ~= false and ctx.result.err == nil
  self:_record(ctx, ok)
end


function MetricsFeature:PreUnexpected(ctx)
  if not self.active then
    return
  end
  self:_record(ctx, false)
end


function MetricsFeature:_record(ctx, ok)
  -- Record once per operation. When a non-2xx result reaches PreDone the
  -- pipeline then errors, firing PreUnexpected too; the missing start
  -- marker makes the second call a no-op.
  local start = self.starts[ctx]
  if start == nil then
    return
  end
  self.starts[ctx] = nil
  local dur = math.max(0, self:_now() - start)

  local client = self.client
  local m = client._metrics
  local key = ((ctx.op ~= nil and ctx.op.entity) or "_") .. "." ..
    ((ctx.op ~= nil and ctx.op.name) or "_")

  local op = m.ops[key]
  if op == nil then
    op = { count = 0, ok = 0, err = 0, totalMs = 0, maxMs = 0 }
    m.ops[key] = op
  end

  self:_bump(m.total, ok, dur)
  self:_bump(op, ok, dur)
end


function MetricsFeature:_bump(bucket, ok, dur)
  bucket.count = bucket.count + 1
  if ok then
    bucket.ok = bucket.ok + 1
  else
    bucket.err = bucket.err + 1
  end
  bucket.totalMs = bucket.totalMs + dur
  if dur > bucket.maxMs then
    bucket.maxMs = dur
  end
end


function MetricsFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


return MetricsFeature
