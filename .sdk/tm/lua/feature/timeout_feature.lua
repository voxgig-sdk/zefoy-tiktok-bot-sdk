-- ZefoyTiktokBot SDK timeout feature
--
-- Per-request timeout. Lua transports are synchronous, so an in-flight
-- request cannot be raced or aborted the way the async targets do it.
-- Instead the wrapped transport is guarded by a wall-clock deadline: the
-- elapsed time of each attempt is measured (via the injectable `now`
-- clock) and, when it exceeds `ms` (default 30000; <= 0 disables), the
-- response is discarded and a `timeout` error is returned in its place.
-- Limitation: the transport call itself still runs to completion before
-- the deadline check applies; only the result delivery is bounded.

local BaseFeature = require("feature.base_feature")

local TimeoutFeature = {}
TimeoutFeature.__index = TimeoutFeature
setmetatable(TimeoutFeature, { __index = BaseFeature })


function TimeoutFeature.new()
  local self = setmetatable(BaseFeature.new(), TimeoutFeature)
  self.version = "0.0.1"
  self.name = "timeout"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function TimeoutFeature:init(ctx, options)
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

  local timeout_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    return timeout_self:_with_timeout(fctx, fullurl, fetchdef, inner)
  end
end


function TimeoutFeature:_with_timeout(ctx, fullurl, fetchdef, inner)
  local ms = self.options["ms"] == nil and 30000 or self.options["ms"]
  if ms <= 0 then
    return inner(ctx, fullurl, fetchdef)
  end

  local start = self:_now()
  local res, err = inner(ctx, fullurl, fetchdef)
  local elapsed = self:_now() - start

  if elapsed > ms then
    self:_track(ctx, ms)
    return nil, ctx:make_error("timeout",
      "Request exceeded timeout of " .. ms .. "ms")
  end

  return res, err
end


function TimeoutFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  -- Millisecond wall clock; os.time() is second precision, which is fine
  -- for the default 30s-scale deadlines. Inject `now` for finer control.
  return os.time() * 1000
end


function TimeoutFeature:_track(ctx, ms)
  local client = self.client
  if client._timeout == nil then
    client._timeout = { count = 0, ms = ms }
  end
  client._timeout.count = client._timeout.count + 1
end


return TimeoutFeature
