-- ZefoyTiktokBot SDK streaming feature
--
-- Streaming result support. For list-style operations it attaches a
-- `result.stream` function (PreResult) returning a stateful Lua iterator
-- so callers can consume items incrementally:
--
--   for item in result.stream() do ... end
--
-- The iterator reads the result's `resdata` lazily (at `stream()` call
-- time), so it reflects downstream result processing. A `chunkDelay` (ms)
-- simulates paced/chunked delivery for offline tests via the injectable
-- `sleep`; a `chunkSize` groups items into batch tables when set.

local BaseFeature = require("feature.base_feature")

local StreamingFeature = {}
StreamingFeature.__index = StreamingFeature
setmetatable(StreamingFeature, { __index = BaseFeature })


function StreamingFeature.new()
  local self = setmetatable(BaseFeature.new(), StreamingFeature)
  self.version = "0.0.1"
  self.name = "streaming"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function StreamingFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end
end


function StreamingFeature:PreResult(ctx)
  if not self.active then
    return
  end
  if not self:_streamable(ctx) then
    return
  end
  local result = ctx.result
  if result == nil then
    return
  end

  local stream_self = self
  result.streaming = true

  result.stream = function()
    return stream_self:_iterate(result)
  end

  local client = self.client
  if client._streaming == nil then
    client._streaming = { opened = 0 }
  end
  client._streaming.opened = client._streaming.opened + 1
end


-- Build a stateful closure iterating the result items (or batches of
-- `chunkSize` items), pacing each step by `chunkDelay` ms.
function StreamingFeature:_iterate(result)
  local chunk_delay = self.options["chunkDelay"] or 0
  local chunk_size = self.options["chunkSize"] or 0

  -- Read lazily so downstream result processing is reflected.
  local items = result.resdata
  if type(items) ~= "table" then
    items = {}
  end

  local i = 0

  if chunk_size > 0 then
    return function()
      if i >= #items then
        return nil
      end
      if chunk_delay > 0 then
        self:_sleep(chunk_delay)
      end
      local batch = {}
      local last = math.min(i + chunk_size, #items)
      for j = i + 1, last do
        table.insert(batch, items[j])
      end
      i = last
      return batch
    end
  end

  return function()
    if i >= #items then
      return nil
    end
    if chunk_delay > 0 then
      self:_sleep(chunk_delay)
    end
    i = i + 1
    return items[i]
  end
end


function StreamingFeature:_streamable(ctx)
  local ops = self.options["ops"] or { "list" }
  local opname = ctx.op ~= nil and ctx.op.name or nil
  for _, o in ipairs(ops) do
    if o == opname then
      return true
    end
  end
  return false
end


function StreamingFeature:_sleep(ms)
  if ms == nil or ms <= 0 then
    return
  end
  local sleep = self.options["sleep"]
  if type(sleep) == "function" then
    sleep(ms)
    return
  end
  -- Portable stdlib-only wait: spin on the CPU clock.
  local target = os.clock() + (ms / 1000)
  while os.clock() < target do end
end


return StreamingFeature
