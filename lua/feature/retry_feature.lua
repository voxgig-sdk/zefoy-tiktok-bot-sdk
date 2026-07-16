-- ZefoyTiktokBot SDK retry feature
--
-- Automatic retry of transient failures with exponential backoff and
-- jitter. Wraps the active transport so a single operation call may make
-- several HTTP attempts. A failure is retryable when the transport returns
-- an error (or no response at all), or responds with a status in
-- `statuses` (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503
-- with a `Retry-After` header (seconds) overrides the computed backoff.
-- The wait (`sleep`) is injectable so tests stay deterministic.

local BaseFeature = require("feature.base_feature")

local RetryFeature = {}
RetryFeature.__index = RetryFeature
setmetatable(RetryFeature, { __index = BaseFeature })


local RETRY_STATUSES = { 408, 425, 429, 500, 502, 503, 504 }


-- Case-insensitive header lookup on a plain header table.
local function header_get(headers, name)
  if type(headers) ~= "table" then
    return nil
  end
  local lower = string.lower(name)
  for k, v in pairs(headers) do
    if type(k) == "string" and string.lower(k) == lower then
      return v
    end
  end
  return nil
end


function RetryFeature.new()
  local self = setmetatable(BaseFeature.new(), RetryFeature)
  self.version = "0.0.1"
  self.name = "retry"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function RetryFeature:init(ctx, options)
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

  local retry_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    return retry_self:_with_retry(fctx, fullurl, fetchdef, inner)
  end
end


function RetryFeature:_with_retry(ctx, fullurl, fetchdef, inner)
  local opts = self.options
  local max = opts["retries"] == nil and 2 or math.floor(tonumber(opts["retries"]) or 0)
  local min_delay = opts["minDelay"] == nil and 50 or opts["minDelay"]
  local max_delay = opts["maxDelay"] == nil and 2000 or opts["maxDelay"]
  local factor = opts["factor"] == nil and 2 or opts["factor"]

  local attempt = 0

  while true do
    local res, err = inner(ctx, fullurl, fetchdef)

    if not self:_retryable(res, err) or attempt >= max then
      -- Out of attempts (or nothing to retry): surface the last
      -- response/error pair unchanged to preserve pipeline semantics.
      return res, err
    end

    local wait = self:_backoff(res, attempt, min_delay, max_delay, factor)
    self:_track(ctx, attempt + 1, res, err, wait)
    self:_sleep(wait)
    attempt = attempt + 1
  end
end


function RetryFeature:_retryable(res, err)
  -- Transport-level error (the Lua analog of a thrown fetch error).
  if err ~= nil then
    return true
  end
  if res == nil then
    return true
  end
  local status = res["status"]
  if type(status) ~= "number" then
    return false
  end
  local statuses = self.options["statuses"] or RETRY_STATUSES
  for _, s in ipairs(statuses) do
    if s == status then
      return true
    end
  end
  return false
end


function RetryFeature:_backoff(res, attempt, min_delay, max_delay, factor)
  -- Honour a server-provided Retry-After (seconds) when present.
  local ra = self:_retry_after(res)
  if ra ~= nil then
    return math.min(max_delay, ra)
  end
  local base = min_delay * (factor ^ attempt)
  local jitter = 0
  if self.options["jitter"] ~= false then
    jitter = math.floor(math.random() * min_delay)
  end
  return math.min(max_delay, base + jitter)
end


function RetryFeature:_retry_after(res)
  if res == nil then
    return nil
  end
  local v = header_get(res["headers"], "retry-after")
  if v == nil then
    return nil
  end
  local n = tonumber(v)
  if n == nil then
    return nil
  end
  return n * 1000
end


function RetryFeature:_sleep(ms)
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


function RetryFeature:_track(ctx, attempt, res, err, wait)
  local client = self.client
  if client._retry == nil then
    client._retry = { attempts = 0, retries = {} }
  end
  client._retry.attempts = client._retry.attempts + 1
  local errmsg = nil
  if err ~= nil then
    if type(err) == "table" and err.msg ~= nil then
      errmsg = err.msg
    else
      errmsg = tostring(err)
    end
  end
  table.insert(client._retry.retries, {
    attempt = attempt,
    status = res ~= nil and res["status"] or nil,
    error = errmsg,
    wait = wait,
  })
end


return RetryFeature
