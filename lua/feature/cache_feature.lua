-- ZefoyTiktokBot SDK cache feature
--
-- Response caching for safe (read) requests. Wraps the active transport
-- and serves a fresh cached snapshot instead of hitting the network when
-- the same method+URL was fetched within `ttl` ms (default 5000). Only
-- successful (2xx) responses to cacheable methods (default: GET) are
-- stored, keyed by method+URL. The cache is bounded (`max` entries,
-- default 256, oldest evicted first) and every hit/miss/bypass is counted
-- on `client._cache`. Snapshots are replayed with a re-readable `json()`
-- body so both the original caller and later hits can parse repeatedly.

local BaseFeature = require("feature.base_feature")

local CacheFeature = {}
CacheFeature.__index = CacheFeature
setmetatable(CacheFeature, { __index = BaseFeature })


function CacheFeature.new()
  local self = setmetatable(BaseFeature.new(), CacheFeature)
  self.version = "0.0.1"
  self.name = "cache"
  self.active = true
  self.client = nil
  self.options = nil
  self.store = {}
  self.order = {}
  return self
end


function CacheFeature:init(ctx, options)
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

  self.store = {}
  self.order = {}

  local cache_self = self
  local utility = ctx.utility
  local inner = utility.fetcher

  utility.fetcher = function(fctx, fullurl, fetchdef)
    return cache_self:_through(fctx, fullurl, fetchdef, inner)
  end
end


function CacheFeature:_through(ctx, fullurl, fetchdef, inner)
  local method = "GET"
  if fetchdef ~= nil and type(fetchdef["method"]) == "string" then
    method = string.upper(fetchdef["method"])
  end

  local methods = self.options["methods"] or { "GET" }
  local cacheable_method = false
  for _, m in ipairs(methods) do
    if m == method then
      cacheable_method = true
      break
    end
  end
  if not cacheable_method then
    return inner(ctx, fullurl, fetchdef)
  end

  local key = method .. " " .. fullurl
  local now = self:_now()
  local hit = self.store[key]

  if hit ~= nil and hit.expiry > now then
    self:_track("hit")
    return self:_replay(hit.snapshot), nil
  end

  local res, err = inner(ctx, fullurl, fetchdef)

  if self:_cacheable(res, err) then
    local snapshot = self:_snapshot(res)
    local ttl = self.options["ttl"] == nil and 5000 or self.options["ttl"]
    self:_evict()
    if self.store[key] == nil then
      table.insert(self.order, key)
    end
    self.store[key] = { expiry = now + ttl, snapshot = snapshot }
    self:_track("miss")
    return self:_replay(snapshot), nil
  end

  self:_track("bypass")
  return res, err
end


function CacheFeature:_cacheable(res, err)
  if err ~= nil or res == nil then
    return false
  end
  local status = res["status"]
  return type(status) == "number" and status >= 200 and status < 300
end


function CacheFeature:_snapshot(res)
  local data = nil
  local jf = res["json"]
  if type(jf) == "function" then
    local ok, v = pcall(jf)
    if ok then
      data = v
    end
  end
  local headers = {}
  if type(res["headers"]) == "table" then
    for k, v in pairs(res["headers"]) do
      if type(k) == "string" then
        headers[string.lower(k)] = v
      end
    end
  end
  return {
    status = res["status"],
    statusText = res["statusText"],
    data = data,
    headers = headers,
  }
end


function CacheFeature:_replay(snapshot)
  -- Fresh header copy per replay so pipeline consumers cannot mutate the
  -- cached snapshot.
  local headers = {}
  for k, v in pairs(snapshot.headers or {}) do
    headers[k] = v
  end
  return {
    status = snapshot.status,
    statusText = snapshot.statusText,
    body = "not-used",
    json = function() return snapshot.data end,
    headers = headers,
  }
end


-- FIFO eviction: drop the oldest stored entries until under `max`.
function CacheFeature:_evict()
  local max = self.options["max"] == nil and 256 or self.options["max"]
  while #self.order >= max do
    local oldest = table.remove(self.order, 1)
    if oldest == nil then
      break
    end
    self.store[oldest] = nil
  end
end


function CacheFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


function CacheFeature:_track(kind)
  local client = self.client
  if client._cache == nil then
    client._cache = { hit = 0, miss = 0, bypass = 0 }
  end
  client._cache[kind] = client._cache[kind] + 1
end


return CacheFeature
