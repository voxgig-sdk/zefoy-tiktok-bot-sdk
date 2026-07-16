-- ZefoyTiktokBot SDK ratelimit feature
--
-- Client-side rate limiting via a token bucket. Each request consumes a
-- token; when the bucket is empty the request waits until the bucket
-- refills at `rate` tokens per second (with capacity `burst`, defaulting
-- to `rate`). This keeps the client under a server's published quota
-- rather than discovering it via 429s. The clock (`now`) and the wait
-- (`sleep`) are injectable so the accounting can be tested
-- deterministically without wall-clock timing.

local BaseFeature = require("feature.base_feature")

local RatelimitFeature = {}
RatelimitFeature.__index = RatelimitFeature
setmetatable(RatelimitFeature, { __index = BaseFeature })


function RatelimitFeature.new()
  local self = setmetatable(BaseFeature.new(), RatelimitFeature)
  self.version = "0.0.1"
  self.name = "ratelimit"
  self.active = true
  self.client = nil
  self.options = nil
  self.tokens = 0
  self.last = 0
  return self
end


function RatelimitFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  if not self.active then
    return
  end

  local rate = self.options["rate"] or 5
  local burst = self.options["burst"] == nil and rate or self.options["burst"]
  self.tokens = burst
  self.last = self:_now()

  local limit_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    limit_self:_acquire(fctx)
    return inner(fctx, fullurl, fetchdef)
  end
end


function RatelimitFeature:_acquire(ctx)
  local rate = self.options["rate"] or 5
  local burst = self.options["burst"] == nil and rate or self.options["burst"]

  -- Refill according to elapsed time.
  local now = self:_now()
  local elapsed = now - self.last
  self.last = now
  self.tokens = math.min(burst, self.tokens + (elapsed / 1000) * rate)

  if self.tokens >= 1 then
    self.tokens = self.tokens - 1
    return
  end

  -- Not enough tokens: wait for one to accrue, then consume it.
  local needed = 1 - self.tokens
  local wait_ms = math.ceil((needed / rate) * 1000)
  self:_track(ctx, wait_ms)
  self:_sleep(wait_ms)
  self.last = self:_now()
  self.tokens = 0
end


function RatelimitFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


function RatelimitFeature:_sleep(ms)
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


function RatelimitFeature:_track(ctx, wait_ms)
  local client = self.client
  if client._ratelimit == nil then
    client._ratelimit = { throttled = 0, waitMs = 0 }
  end
  client._ratelimit.throttled = client._ratelimit.throttled + 1
  client._ratelimit.waitMs = client._ratelimit.waitMs + wait_ms
end


return RatelimitFeature
