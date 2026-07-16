-- ZefoyTiktokBot SDK netsim feature
--
-- Network behaviour simulation. Wraps the active transport (the live
-- fetcher or the `test` feature's in-memory mock) and injects realistic
-- network conditions so offline unit tests can exercise slowness,
-- transient failures, rate limiting and outages deterministically.
--
-- Every injection mode is counter-driven (per client instance) so tests
-- are reproducible without mocking timers. `failRate` adds optional
-- pseudo-random failures via a seeded LCG for coverage-style testing:
--   seed = (seed * 1103515245 + 12345) % 0x80000000
--   rand = seed / 0x80000000

local BaseFeature = require("feature.base_feature")

local NetsimFeature = {}
NetsimFeature.__index = NetsimFeature
setmetatable(NetsimFeature, { __index = BaseFeature })


local function to_int(v)
  return math.floor(tonumber(v) or 0)
end


function NetsimFeature.new()
  local self = setmetatable(BaseFeature.new(), NetsimFeature)
  self.version = "0.0.1"
  self.name = "netsim"
  self.active = true
  self.client = nil
  self.options = nil
  self.calls = 0
  self.seed = 1
  return self
end


function NetsimFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  local seed = to_int(self.options["seed"])
  if seed == 0 then
    seed = 1
  end
  self.seed = seed

  if not self.active then
    return
  end

  local sim_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    return sim_self:_simulate(fctx, fullurl, fetchdef, inner)
  end
end


function NetsimFeature:_simulate(ctx, fullurl, fetchdef, inner)
  local opts = self.options
  self.calls = self.calls + 1
  local call = self.calls

  -- Record the simulated conditions for test/debug inspection.
  local applied = {}

  -- Total outage: every call fails at the transport level.
  if opts["offline"] == true then
    self:_sleep(self:_pick_latency())
    applied.offline = true
    self:_track(ctx, applied)
    return nil, ctx:make_error("netsim_offline",
      'Simulated network offline (URL was: "' .. fullurl .. '")')
  end

  -- Connection-level errors for the first N calls (e.g. ECONNRESET).
  if call <= to_int(opts["errorTimes"]) then
    self:_sleep(self:_pick_latency())
    applied.error = true
    self:_track(ctx, applied)
    return nil, ctx:make_error("netsim_conn",
      "Simulated connection error (call " .. call .. ")")
  end

  -- Rate-limit responses (HTTP 429 + Retry-After) for the first N calls.
  if call <= to_int(opts["rateLimitTimes"]) then
    self:_sleep(self:_pick_latency())
    applied.rateLimited = true
    self:_track(ctx, applied)
    local retry_after = opts["retryAfter"] == nil and 0 or opts["retryAfter"]
    return self:_respond(429, nil, {
      statusText = "Too Many Requests",
      headers = { ["retry-after"] = tostring(retry_after) },
    }), nil
  end

  -- Retryable failure status for the first N calls, or every Nth call.
  local fail_status = opts["failStatus"] == nil and 503 or opts["failStatus"]
  local fail_every = to_int(opts["failEvery"])
  local fail_rate = tonumber(opts["failRate"]) or 0
  local fail_by_count = call <= to_int(opts["failTimes"])
  local fail_by_every = fail_every > 0 and call % fail_every == 0
  local fail_by_rate = fail_rate > 0 and self:_rand() < fail_rate
  if fail_by_count or fail_by_every or fail_by_rate then
    self:_sleep(self:_pick_latency())
    applied.failStatus = fail_status
    self:_track(ctx, applied)
    return self:_respond(fail_status, nil, { statusText = "Simulated Failure" }), nil
  end

  -- Otherwise: apply latency then delegate to the real transport.
  local latency = self:_pick_latency()
  applied.latency = latency
  self:_track(ctx, applied)
  self:_sleep(latency)
  return inner(ctx, fullurl, fetchdef)
end


-- Latency in ms: a fixed number, or a uniform sample from {min,max}.
function NetsimFeature:_pick_latency()
  local l = self.options["latency"]
  if l == nil then
    return 0
  end
  if type(l) == "number" then
    if l < 0 then
      return 0
    end
    return l
  end
  local min = to_int(l["min"])
  local max = l["max"] == nil and min or to_int(l["max"])
  if max <= min then
    return min
  end
  return min + math.floor(self:_rand() * (max - min))
end


function NetsimFeature:_sleep(ms)
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


-- Deterministic 0..1 pseudo-random via a linear congruential generator.
function NetsimFeature:_rand()
  self.seed = (self.seed * 1103515245 + 12345) % 0x80000000
  return self.seed / 0x80000000
end


function NetsimFeature:_track(ctx, applied)
  local client = self.client
  if client._netsim == nil then
    client._netsim = { calls = 0, applied = {} }
  end
  client._netsim.calls = client._netsim.calls + 1
  table.insert(client._netsim.applied, applied)
  if ctx.ctrl ~= nil and ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["netsim"] = client._netsim
  end
end


-- Build a transport-shaped response (matching the test feature's mock)
-- with the plain lowercase header table the result pipeline understands.
function NetsimFeature:_respond(status, data, extra)
  local out = {
    status = status,
    statusText = "OK",
    json = function() return data end,
    body = "not-used",
    headers = {},
  }
  if type(extra) == "table" then
    for k, v in pairs(extra) do
      out[k] = v
    end
  end
  return out
end


return NetsimFeature
