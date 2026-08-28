-- ZefoyTiktokBot SDK feature test
--
-- Behavioural + coverage tests for the enterprise features shipped with
-- this SDK. Each block runs only when its feature is present (see
-- has_feature), driving the real feature module through an offline
-- harness pipeline against a simulated network. The harness is a faithful
-- miniature of the real operation pipeline: the same hook order,
-- short-circuit rules and fetcher-chain (res, err) conventions as the
-- generated entity code, but with no live server and no API-specific
-- fixtures.

local vs = require("utility.struct.struct")


-- True when this SDK was generated with the named feature.
local function has_feature(name)
  local ok = pcall(require, "feature." .. name .. "_feature")
  return ok
end


-- Build a feature instance by name: prefer the generated `features`
-- factory, falling back to the feature module directly (so this test also
-- runs against the raw templates).
local function make_feature(name)
  local ok, factory = pcall(require, "features")
  if ok and type(factory) == "table" and type(factory[name]) == "function" then
    return factory[name]()
  end
  local mod = require("feature." .. name .. "_feature")
  return mod.new()
end


-- A deterministic virtual clock: `now()` advances only when `sleep(ms)`
-- is called, so timing-based features can be asserted without real
-- delays.
local function make_clock(start)
  local t = start or 0
  return {
    now = function() return t end,
    sleep = function(ms) t = t + (ms or 0) end,
    advance = function(ms) t = t + (ms or 0) end,
    time = function() return t end,
  }
end


local function make_err(code, msg)
  return { is_sdk_error = true, code = code, msg = msg }
end

local function is_err(v)
  return type(v) == "table" and v.is_sdk_error == true
end


-- Build a transport-shaped response the pipeline understands (plain
-- lowercase header table, re-readable json body).
local function make_response(status, data, headers)
  local h = {}
  for k, v in pairs(headers or {}) do
    h[string.lower(k)] = v
  end
  return {
    status = status,
    statusText = status < 400 and "OK" or "ERR",
    body = "not-used",
    json = function() return data end,
    headers = h,
  }
end


local function default_server(fctx, fullurl, fetchdef)
  local method = string.upper(fetchdef["method"] or "GET")
  if method == "GET" then
    return make_response(200, { ok = true, method = method })
  end
  return make_response(200, { ok = true, method = method, echo = fetchdef["body"] })
end


-- A server that records every call; `reply(n, fetchdef)` may customise
-- the n-th response.
local function recording_server(reply)
  local calls = {}
  local function server(fctx, fullurl, fetchdef)
    table.insert(calls, { url = fullurl, fetchdef = fetchdef })
    if reply ~= nil then
      return reply(#calls, fetchdef)
    end
    return make_response(200, { ok = true, n = #calls })
  end
  return { server = server, calls = calls }
end


local function default_method(opname)
  if opname == "create" then return "POST" end
  if opname == "update" then return "PATCH" end
  if opname == "remove" then return "DELETE" end
  return "GET"
end


-- Construct a fake client wired with the given features (in init order)
-- and a mini operation pipeline. `spec.features` is a list of
-- { name = ..., options = ... }.
local function make_client(spec)
  local base = spec.base or "http://api.test"
  local server = spec.server or default_server

  local utility = { fetcher = server }

  local client = {
    mode = "test",
    features = {},
    _options = { base = base, headers = spec.headers or {}, feature = {} },
  }
  function client:options_map()
    local out = vs.clone(self._options)
    if type(out) == "table" then
      return out
    end
    return {}
  end

  local idseq = 0
  local function make_ctx(over)
    idseq = idseq + 1
    local ctx = {
      id = "C" .. idseq,
      client = client,
      utility = utility,
      out = {},
      ctrl = over.ctrl or {},
      meta = {},
      op = over.op,
      entity = over.entity,
    }
    function ctx:make_error(code, msg)
      return make_err(code, msg)
    end
    return ctx
  end

  local function feature_hook(ctx, name)
    for _, f in ipairs(client.features) do
      local fn = f[name]
      if type(fn) == "function" then
        fn(f, ctx)
      end
    end
  end

  local rootctx = make_ctx({ op = { name = "root", entity = "_" } })

  -- Instantiate + init the requested features (skipping any not present
  -- in this SDK). PostConstruct fires via ready(), as in the real client.
  for _, fspec in ipairs(spec.features) do
    if has_feature(fspec.name) then
      local f = make_feature(fspec.name)
      local fopts = { active = true }
      for k, v in pairs(fspec.options or {}) do
        fopts[k] = v
      end
      client._options.feature[f:get_name()] = fopts
      f:init(rootctx, fopts)
      table.insert(client.features, f)
    end
  end

  local function build_url(sp)
    local q = sp.query or {}
    local keys = {}
    for k, v in pairs(q) do
      if v ~= nil then
        table.insert(keys, k)
      end
    end
    table.sort(keys)
    local parts = {}
    for _, k in ipairs(keys) do
      table.insert(parts, vs.escurl(tostring(k)) .. "=" .. vs.escurl(tostring(q[k])))
    end
    local qs = table.concat(parts, "&")
    if qs ~= "" then
      return sp.base .. (sp.path or "") .. "?" .. qs
    end
    return sp.base .. (sp.path or "")
  end

  local function populate_result(ctx, response, rerr)
    local result = { ok = false, status = -1, statusText = "", headers = {} }
    ctx.result = result

    if rerr ~= nil then
      result.err = rerr
      return
    end
    if response == nil then
      result.err = make_err("no_response", "response: nil")
      return
    end
    result.status = response["status"]
    result.statusText = response["statusText"]
    if type(response["headers"]) == "table" then
      for k, v in pairs(response["headers"]) do
        result.headers[k] = v
      end
    end
    if type(response["json"]) == "function" then
      local ok, body = pcall(response["json"])
      if ok then
        result.body = body
      end
    end
    result.resdata = result.body
    if type(result.status) == "number" and result.status >= 400 then
      result.err = make_err("request_status",
        "request: " .. result.status .. ": " .. tostring(result.statusText))
    end
    if result.err == nil then
      result.ok = true
    end
  end

  local h = {
    client = client,
    utility = utility,
    rootctx = rootctx,
  }

  -- Fire PostConstruct (the real client does this at construction).
  function h.ready()
    feature_hook(rootctx, "PostConstruct")
  end

  function h.feature(name)
    for _, f in ipairs(client.features) do
      if f:get_name() == name then
        return f
      end
    end
    return nil
  end

  -- Run one operation through the mini pipeline (mirrors the generated
  -- _run_op: hook, short-circuit, make*, hook, ...).
  function h.op(o)
    o = o or {}
    local entity = o.entity or "widget"
    local opname = o.op or "load"
    local method = o.method or default_method(opname)

    local ctx = make_ctx({
      op = { name = opname, entity = entity },
      entity = { name = entity },
      ctrl = o.ctrl or {},
    })

    feature_hook(ctx, "PostConstructEntity")

    feature_hook(ctx, "PrePoint")
    if is_err(ctx.out["point"]) then
      ctx.ctrl.err = ctx.out["point"]
      feature_hook(ctx, "PreUnexpected")
      return { ok = false, error = ctx.out["point"], result = ctx.result, ctx = ctx }
    end

    feature_hook(ctx, "PreSpec")
    if ctx.out["spec"] ~= nil then
      ctx.spec = ctx.out["spec"]
    else
      local headers = {}
      for k, v in pairs(spec.headers or {}) do
        headers[k] = v
      end
      for k, v in pairs(o.headers or {}) do
        headers[k] = v
      end
      local query = {}
      for k, v in pairs(o.query or {}) do
        query[k] = v
      end
      ctx.spec = {
        method = method,
        base = base,
        path = o.path or ("/" .. entity),
        params = {},
        headers = headers,
        query = query,
        body = o.body,
        step = "start",
      }
    end

    feature_hook(ctx, "PreRequest")
    ctx.spec.url = build_url(ctx.spec)

    local response, rerr
    if ctx.out["request"] ~= nil then
      response = ctx.out["request"]
    else
      local fetchdef = {
        url = ctx.spec.url,
        method = ctx.spec.method,
        headers = ctx.spec.headers,
        body = ctx.spec.body,
      }
      response, rerr = utility.fetcher(ctx, fetchdef.url, fetchdef)
    end
    ctx.response = response

    feature_hook(ctx, "PreResponse")
    populate_result(ctx, response, rerr)
    feature_hook(ctx, "PreResult")
    feature_hook(ctx, "PreDone")

    if ctx.result ~= nil and ctx.result.ok then
      return { ok = true, data = ctx.result.resdata, result = ctx.result, ctx = ctx }
    end

    local err = (ctx.result ~= nil and ctx.result.err) or
      make_err("op_failed", "operation failed")
    ctx.ctrl.err = err
    feature_hook(ctx, "PreUnexpected")
    return { ok = false, error = err, result = ctx.result, ctx = ctx }
  end

  return h
end


describe("feature", function()

  it("at least the test feature is present", function()
    assert.is_true(has_feature("test"))
  end)


  -- netsim --------------------------------------------------------------
  if has_feature("netsim") then describe("netsim", function()

    it("fixed latency then delegate", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = { latency = 250, sleep = clock.sleep } },
      } })
      local res = h.op({ op = "load", ctrl = { explain = {} } })
      assert.is_true(res.ok)
      assert.are.equal(250, clock.time())
      assert.are.equal(1, h.client._netsim.calls)
    end)

    it("ranged latency samples within [min,max)", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = {
          latency = { min = 100, max = 300 }, seed = 7, sleep = clock.sleep } },
      } })
      h.op({ op = "load" })
      assert.is_true(clock.time() >= 100 and clock.time() < 300,
        "latency in range, got " .. clock.time())
    end)

    it("equal min/max latency is exact", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = {
          latency = { min = 50, max = 50 }, sleep = clock.sleep } },
      } })
      h.op({ op = "load" })
      assert.are.equal(50, clock.time())
    end)

    it("failTimes returns a retryable status", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 2, failStatus = 503 } },
      } })
      assert.are.equal(503, h.op({ op = "load" }).result.status)
      assert.are.equal(503, h.op({ op = "load" }).result.status)
      assert.is_true(h.op({ op = "load" }).ok)
    end)

    it("failEvery fails every Nth call", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failEvery = 2 } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
      assert.is_false(h.op({ op = "load" }).ok)
      assert.is_true(h.op({ op = "load" }).ok)
    end)

    it("failRate with a seed is deterministic", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failRate = 1, seed = 5 } },
      } })
      assert.is_false(h.op({ op = "load" }).ok)
    end)

    it("errorTimes returns a connection error", function()
      local h = make_client({ features = {
        { name = "netsim", options = { errorTimes = 1 } },
      } })
      assert.are.equal("netsim_conn", h.op({ op = "load" }).error.code)
    end)

    it("offline fails every call", function()
      local h = make_client({ features = {
        { name = "netsim", options = { offline = true } },
      } })
      assert.are.equal("netsim_offline", h.op({ op = "load" }).error.code)
    end)

    it("rateLimitTimes returns 429 + Retry-After", function()
      local h = make_client({ features = {
        { name = "netsim", options = { rateLimitTimes = 1, retryAfter = 3 } },
      } })
      local res = h.op({ op = "load" })
      assert.are.equal(429, res.result.status)
      assert.are.equal("3", res.result.headers["retry-after"])
    end)

    it("inactive netsim does not wrap", function()
      local h = make_client({ features = {
        { name = "netsim", options = { active = false } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
      assert.is_nil(h.client._netsim)
    end)

    it("no latency option delays nothing", function()
      local h = make_client({ features = { { name = "netsim", options = {} } } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)
  end) end


  -- retry ---------------------------------------------------------------
  if has_feature("retry") then describe("retry", function()

    if has_feature("netsim") then it("retries transient failures then succeeds", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 2, failStatus = 503 } },
        { name = "retry", options = {
          retries = 3, minDelay = 10, jitter = false, sleep = clock.sleep } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
      assert.are.equal(2, h.client._retry.attempts)
    end) end

    if has_feature("netsim") then it("gives up after the budget", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 9, failStatus = 500 } },
        { name = "retry", options = {
          retries = 2, minDelay = 1, jitter = false, sleep = clock.sleep } },
      } })
      assert.are.equal(500, h.op({ op = "load" }).result.status)
    end) end

    it("does not retry a non-retryable status", function()
      local rec = recording_server(function() return make_response(404) end)
      local h = make_client({ features = {
        { name = "retry", options = { retries = 3, minDelay = 0 } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.are.equal(1, #rec.calls)
    end)

    it("retries a transport error then surfaces it when exhausted", function()
      local clock = make_clock()
      local n = 0
      local function server()
        n = n + 1
        return nil, make_err("boom", "boom")
      end
      local h = make_client({ features = {
        { name = "retry", options = {
          retries = 2, minDelay = 1, jitter = false, sleep = clock.sleep } },
      }, server = server })
      local res = h.op({ op = "load" })
      assert.is_false(res.ok)
      assert.are.equal(3, n)
    end)

    if has_feature("netsim") then it("honours a server Retry-After", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = { rateLimitTimes = 1, retryAfter = 2 } },
        { name = "retry", options = {
          retries = 2, minDelay = 10, maxDelay = 60000,
          jitter = false, sleep = clock.sleep } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
      assert.are.equal(2000, clock.time())
    end) end

    if has_feature("netsim") then it("default jitter path still succeeds", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 1 } },
        { name = "retry", options = { retries = 2, minDelay = 0 } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end) end

    it("inactive retry does not wrap", function()
      local rec = recording_server(function() return make_response(503) end)
      local h = make_client({ features = {
        { name = "retry", options = { active = false } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.are.equal(1, #rec.calls)
    end)

    it("retries a nil transport result", function()
      local n = 0
      local function server()
        n = n + 1
        if n < 2 then
          return nil
        end
        return make_response(200, { ok = true })
      end
      local h = make_client({ features = {
        { name = "retry", options = { retries = 3, minDelay = 0 } },
      }, server = server })
      assert.is_true(h.op({ op = "load" }).ok)
      assert.are.equal(2, n)
    end)

    it("non-numeric status is not retryable", function()
      local rec = recording_server(function()
        return { status = "weird", json = function() return {} end, headers = {} }
      end)
      local h = make_client({ features = {
        { name = "retry", options = { retries = 3, minDelay = 0 } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.are.equal(1, #rec.calls)
    end)
  end) end


  -- timeout -------------------------------------------------------------
  -- Lua transports are synchronous: the timeout feature applies a
  -- wall-clock deadline after the attempt rather than racing it, so the
  -- shared virtual clock stands in for elapsed transport time.
  if has_feature("timeout") then describe("timeout", function()

    if has_feature("netsim") then it("a slow request times out", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "netsim", options = { latency = 80, sleep = clock.sleep } },
        { name = "timeout", options = { ms = 10, now = clock.now } },
      } })
      local res = h.op({ op = "load" })
      assert.are.equal("timeout", res.error.code)
      assert.are.equal(1, h.client._timeout.count)
    end) end

    it("a fast request passes through", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "timeout", options = { ms = 1000, now = clock.now } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)

    it("ms<=0 disables the timeout", function()
      local h = make_client({ features = {
        { name = "timeout", options = { ms = 0 } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)

    it("inactive timeout does not wrap", function()
      local h = make_client({ features = {
        { name = "timeout", options = { active = false } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)
  end) end


  -- ratelimit -----------------------------------------------------------
  if has_feature("ratelimit") then describe("ratelimit", function()

    it("throttles once the burst is spent", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "ratelimit", options = {
          rate = 1, burst = 2, now = clock.now, sleep = clock.sleep } },
      } })
      h.op({ op = "load" })
      h.op({ op = "load" })
      h.op({ op = "load" })
      assert.are.equal(1, h.client._ratelimit.throttled)
      assert.is_true(clock.time() > 0)
    end)

    it("burst defaults to rate and refills over time", function()
      local clock = make_clock()
      local h = make_client({ features = {
        { name = "ratelimit", options = {
          rate = 2, now = clock.now, sleep = clock.sleep } },
      } })
      h.op({ op = "load" })
      h.op({ op = "load" })
      clock.advance(1000) -- refill
      h.op({ op = "load" })
      local throttled = h.client._ratelimit == nil and 0 or h.client._ratelimit.throttled
      assert.are.equal(0, throttled)
    end)

    it("inactive ratelimit does not wrap", function()
      local h = make_client({ features = {
        { name = "ratelimit", options = { active = false } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)
  end) end


  -- cache ---------------------------------------------------------------
  if has_feature("cache") then describe("cache", function()

    it("serves a repeated read from cache", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "cache", options = { ttl = 10000 } },
      }, server = rec.server })
      local a = h.op({ op = "load", path = "/w/1" })
      local b = h.op({ op = "load", path = "/w/1" })
      assert.are.equal(1, #rec.calls)
      assert.are.same(a.data, b.data)
      assert.are.equal(1, h.client._cache.hit)
    end)

    it("does not cache non-GET", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "cache" },
      }, server = rec.server })
      h.op({ op = "create", path = "/w" })
      h.op({ op = "create", path = "/w" })
      assert.are.equal(2, #rec.calls)
    end)

    it("does not cache a non-2xx (bypass)", function()
      local rec = recording_server(function() return make_response(500) end)
      local h = make_client({ features = {
        { name = "cache" },
      }, server = rec.server })
      h.op({ op = "load", path = "/w" })
      h.op({ op = "load", path = "/w" })
      assert.are.equal(2, #rec.calls)
      assert.are.equal(2, h.client._cache.bypass)
    end)

    it("re-fetches after the ttl", function()
      local clock = make_clock()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "cache", options = { ttl = 1000, now = clock.now } },
      }, server = rec.server })
      h.op({ op = "load", path = "/w" })
      clock.advance(1500)
      h.op({ op = "load", path = "/w" })
      assert.are.equal(2, #rec.calls)
    end)

    it("evicts the oldest entry past max", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "cache", options = { ttl = 10000, max = 1 } },
      }, server = rec.server })
      h.op({ op = "load", path = "/a" })
      h.op({ op = "load", path = "/b" }) -- evicts /a
      h.op({ op = "load", path = "/a" }) -- miss again
      assert.are.equal(3, #rec.calls)
    end)

    it("inactive cache does not wrap", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "cache", options = { active = false } },
      }, server = rec.server })
      h.op({ op = "load", path = "/x" })
      h.op({ op = "load", path = "/x" })
      assert.are.equal(2, #rec.calls)
    end)
  end) end


  -- idempotency ---------------------------------------------------------
  if has_feature("idempotency") then describe("idempotency", function()

    it("adds a key to mutating ops", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency" },
      }, server = rec.server })
      h.op({ op = "create", path = "/w" })
      assert.is_not_nil(rec.calls[1].fetchdef.headers["Idempotency-Key"])
    end)

    it("adds a key based on HTTP method", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency" },
      }, server = rec.server })
      h.op({ op = "act", method = "PUT", path = "/w" })
      assert.is_not_nil(rec.calls[1].fetchdef.headers["Idempotency-Key"])
    end)

    it("leaves reads untouched", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency" },
      }, server = rec.server })
      h.op({ op = "load", path = "/w/1" })
      assert.is_nil(rec.calls[1].fetchdef.headers["Idempotency-Key"])
    end)

    it("preserves a caller key and honours a custom header", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency", options = { header = "X-Idem" } },
      }, server = rec.server })
      h.op({ op = "create", path = "/w", headers = { ["X-Idem"] = "caller-1" } })
      assert.are.equal("caller-1", rec.calls[1].fetchdef.headers["X-Idem"])
    end)

    it("default key generation yields a hex key", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency" },
      }, server = rec.server })
      h.op({ op = "create", path = "/w" })
      local key = rec.calls[1].fetchdef.headers["Idempotency-Key"]
      assert.is_truthy(string.match(key, "^[0-9a-f]+$"))
    end)

    it("injected keygen is used", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency", options = { keygen = function() return "fixed-key" end } },
      }, server = rec.server })
      h.op({ op = "create", path = "/w" })
      assert.are.equal("fixed-key", rec.calls[1].fetchdef.headers["Idempotency-Key"])
      assert.are.equal("fixed-key", h.client._idempotency.last)
    end)

    it("inactive idempotency adds nothing", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "idempotency", options = { active = false } },
      }, server = rec.server })
      h.op({ op = "create", path = "/w" })
      assert.is_nil(rec.calls[1].fetchdef.headers["Idempotency-Key"])
    end)
  end) end


  -- rbac ----------------------------------------------------------------
  if has_feature("rbac") then describe("rbac", function()

    it("denies before any call", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "rbac", options = {
          rules = { ["widget.remove"] = "admin" }, permissions = {} } },
      }, server = rec.server })
      local res = h.op({ op = "remove", path = "/w/1" })
      assert.are.equal("rbac_denied", res.error.code)
      assert.are.equal(0, #rec.calls)
      assert.are.equal(1, h.client._rbac.denied)
    end)

    it("allows a held permission", function()
      local h = make_client({ features = {
        { name = "rbac", options = {
          rules = { ["widget.remove"] = "admin" }, permissions = { "admin" } } },
      } })
      assert.is_true(h.op({ op = "remove", path = "/w/1" }).ok)
    end)

    it("rule by op name and wildcard grant", function()
      local h = make_client({ features = {
        { name = "rbac", options = { rules = { load = "read" }, permissions = { "*" } } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)

    it("no rule allows by default; deny=true blocks", function()
      local allow = make_client({ features = {
        { name = "rbac", options = { permissions = {} } },
      } })
      assert.is_true(allow.op({ op = "load" }).ok)
      local deny = make_client({ features = {
        { name = "rbac", options = { deny = true, permissions = {} } },
      } })
      assert.are.equal("rbac_denied", deny.op({ op = "load" }).error.code)
    end)

    it("inactive rbac does not deny", function()
      local h = make_client({ features = {
        { name = "rbac", options = { active = false, deny = true, permissions = {} } },
      } })
      assert.is_true(h.op({ op = "load" }).ok)
    end)
  end) end


  -- metrics ---------------------------------------------------------------
  if has_feature("metrics") then describe("metrics", function()

    if has_feature("netsim") then it("counts ok and err per op", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 1, failStatus = 500 } },
        { name = "metrics", options = {} },
      } })
      h.op({ op = "load" })
      h.op({ op = "load" })
      h.op({ op = "list" })
      local m = h.client._metrics
      assert.are.equal(3, m.total.count)
      assert.are.equal(2, m.total.ok)
      assert.are.equal(1, m.total.err)
      assert.are.equal(2, m.ops["widget.load"].count)
    end) end

    it("injected clock accumulates durations", function()
      local t = 0
      local h = make_client({ features = {
        { name = "metrics", options = { now = function() t = t + 10; return t end } },
      } })
      h.op({ op = "load" })
      assert.is_true(h.client._metrics.total.totalMs >= 0)
      assert.are.equal(1, h.client._metrics.total.count)
    end)

    it("inactive metrics records nothing", function()
      local h = make_client({ features = {
        { name = "metrics", options = { active = false } },
      } })
      h.op({ op = "load" })
      assert.is_nil(h.client._metrics)
    end)
  end) end


  -- telemetry -------------------------------------------------------------
  if has_feature("telemetry") then describe("telemetry", function()

    it("opens spans and propagates trace headers", function()
      local rec = recording_server()
      local spans = {}
      local h = make_client({ features = {
        { name = "telemetry", options = { exporter = function(s) table.insert(spans, s) end } },
      }, server = rec.server })
      local res = h.op({ op = "load" })
      assert.is_true(res.ok)
      assert.are.equal(1, #h.client._telemetry.spans)
      assert.are.equal(1, #spans)
      local sent = rec.calls[1].fetchdef.headers
      assert.are.equal(h.client._telemetry.spans[1].traceId, sent["X-Trace-Id"])
      assert.is_truthy(string.match(sent["traceparent"], "^00%-.+%-.+%-01$"))
    end)

    if has_feature("netsim") then it("records a failed span on error", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 1, failStatus = 500 } },
        { name = "telemetry", options = {} },
      } })
      h.op({ op = "load" })
      assert.is_false(h.client._telemetry.spans[1].ok)
    end) end

    it("default id generation and no exporter", function()
      local h = make_client({ features = { { name = "telemetry" } } })
      h.op({ op = "load" })
      assert.is_truthy(string.match(h.client._telemetry.spans[1].traceId, "^t"))
    end)

    it("injected idgen + clock", function()
      local h = make_client({ features = {
        { name = "telemetry", options = {
          idgen = function(k) return k .. "-X" end, now = function() return 5 end } },
      } })
      h.op({ op = "load" })
      local span = h.client._telemetry.spans[1]
      assert.are.equal("trace-X", span.traceId)
      assert.are.equal(0, span.durationMs)
    end)

    it("inactive telemetry records nothing", function()
      local h = make_client({ features = {
        { name = "telemetry", options = { active = false } },
      } })
      h.op({ op = "load" })
      assert.is_nil(h.client._telemetry)
    end)
  end) end


  -- debug -----------------------------------------------------------------
  if has_feature("debug") then describe("debug", function()

    it("captures a redacted trace and honours on_entry + max", function()
      local seen = {}
      local h = make_client({ features = {
        { name = "debug", options = {
          max = 1, on_entry = function(e) table.insert(seen, e) end } },
      } })
      h.op({ op = "load", headers = { authorization = "Bearer secret" } })
      h.op({ op = "list" })
      local entries = h.client._debug.entries
      assert.are.equal(1, #entries) -- ring buffer capped at max
      assert.are.equal(2, #seen)
      assert.are.equal("<redacted>", seen[1].headers.authorization)
    end)

    if has_feature("netsim") then it("captures failures", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 1, failStatus = 500 } },
        { name = "debug", options = {} },
      } })
      h.op({ op = "load" })
      assert.is_false(h.client._debug.entries[1].ok)
    end) end

    it("injected clock + custom redact", function()
      local h = make_client({ features = {
        { name = "debug", options = { now = function() return 7 end, redact = { "x-secret" } } },
      } })
      h.op({ op = "load", headers = { ["x-secret"] = "hide", ["x-ok"] = "show" } })
      local e = h.client._debug.entries[1]
      assert.are.equal("<redacted>", e.headers["x-secret"])
      assert.are.equal("show", e.headers["x-ok"])
    end)

    it("inactive debug records nothing", function()
      local h = make_client({ features = {
        { name = "debug", options = { active = false } },
      } })
      h.op({ op = "load" })
      assert.is_nil(h.client._debug)
    end)
  end) end


  -- audit -----------------------------------------------------------------
  if has_feature("audit") then describe("audit", function()

    if has_feature("netsim") then it("one record per op with sink + actor", function()
      local sink = {}
      local h = make_client({ features = {
        { name = "netsim", options = { failTimes = 1, failStatus = 500 } },
        { name = "audit", options = {
          actor = "svc", sink = function(r) table.insert(sink, r) end, max = 5 } },
      } })
      h.op({ op = "remove", path = "/w/1" })
      h.op({ op = "load", ctrl = { actor = "per-call" } })
      local recs = h.client._audit.records
      assert.are.equal(2, #recs)
      assert.are.equal("error", recs[1].outcome)
      assert.are.equal("svc", recs[1].actor)
      assert.are.equal("per-call", recs[2].actor)
      assert.are.equal(2, #sink)
    end) end

    it("default actor is anonymous", function()
      local h = make_client({ features = { { name = "audit" } } })
      h.op({ op = "load" })
      assert.are.equal("anonymous", h.client._audit.records[1].actor)
    end)

    it("injected clock stamps ts", function()
      local h = make_client({ features = {
        { name = "audit", options = { now = function() return 42 end } },
      } })
      h.op({ op = "load" })
      assert.are.equal(42, h.client._audit.records[1].ts)
    end)

    it("inactive audit records nothing", function()
      local h = make_client({ features = {
        { name = "audit", options = { active = false } },
      } })
      h.op({ op = "load" })
      assert.is_nil(h.client._audit)
    end)
  end) end


  -- clienttrack -------------------------------------------------------------
  if has_feature("clienttrack") then describe("clienttrack", function()

    it("stable client id, unique request ids, UA", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "clienttrack", options = { clientName = "Acme", clientVersion = "2.0.0" } },
      }, server = rec.server })
      h.ready()
      h.op({ op = "load" })
      h.op({ op = "load" })
      local h0 = rec.calls[1].fetchdef.headers
      local h1 = rec.calls[2].fetchdef.headers
      assert.are.equal("Acme/2.0.0", h0["User-Agent"])
      assert.are.equal(h0["X-Client-Id"], h1["X-Client-Id"])
      assert.is_true(h0["X-Request-Id"] ~= h1["X-Request-Id"])
      assert.are.equal(2, h.client._clienttrack.requests)
    end)

    it("does not clobber a caller User-Agent", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "clienttrack" },
      }, server = rec.server })
      h.ready()
      h.op({ op = "load", headers = { ["User-Agent"] = "mine" } })
      assert.are.equal("mine", rec.calls[1].fetchdef.headers["User-Agent"])
    end)

    it("lazy session id without PostConstruct", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "clienttrack" },
      }, server = rec.server })
      -- no ready() -> PreRequest lazily creates the session id
      h.op({ op = "load" })
      assert.is_not_nil(rec.calls[1].fetchdef.headers["X-Client-Id"])
    end)

    it("injected idgen + fixed session", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "clienttrack", options = {
          sessionId = "S1", idgen = function(k) return k .. "-1" end } },
      }, server = rec.server })
      h.ready()
      h.op({ op = "load" })
      assert.are.equal("S1", rec.calls[1].fetchdef.headers["X-Client-Id"])
      assert.are.equal("request-1", rec.calls[1].fetchdef.headers["X-Request-Id"])
    end)

    it("inactive clienttrack adds nothing", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "clienttrack", options = { active = false } },
      }, server = rec.server })
      h.ready()
      h.op({ op = "load" })
      assert.is_nil(rec.calls[1].fetchdef.headers["X-Client-Id"])
    end)
  end) end


  -- paging ------------------------------------------------------------------
  if has_feature("paging") then describe("paging", function()

    it("stamps page/limit and reads header signals", function()
      local rec = recording_server(function()
        return make_response(200, { items = { 1, 2 } }, {
          ["x-next-page"] = "2",
          ["x-total-count"] = "5",
          ["link"] = '</w?page=2>; rel="next"',
        })
      end)
      local h = make_client({ features = {
        { name = "paging", options = { limit = 2 } },
      }, server = rec.server })
      local res = h.op({ op = "list", path = "/w" })
      assert.is_truthy(string.find(rec.calls[1].url, "[?&]page=1"))
      assert.is_truthy(string.find(rec.calls[1].url, "[?&]limit=2"))
      assert.are.equal(2, res.result.paging.nextPage)
      assert.are.equal(5, res.result.paging.totalCount)
      assert.are.equal("/w?page=2", res.result.paging.next)
    end)

    it("body cursor + explicit cursor request", function()
      local rec = recording_server(function()
        return make_response(200, { nextCursor = "abc", hasMore = true })
      end)
      local h = make_client({ features = {
        { name = "paging" },
      }, server = rec.server })
      local res = h.op({ op = "list", path = "/w", ctrl = { paging = { cursor = "xyz" } } })
      assert.is_truthy(string.find(rec.calls[1].url, "[?&]cursor=xyz"))
      assert.are.equal("abc", res.result.paging.cursor)
      assert.is_true(res.result.paging.hasMore)
    end)

    it("non-list op is not paged", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "paging" },
      }, server = rec.server })
      h.op({ op = "load", path = "/w/1" })
      assert.is_nil(string.find(rec.calls[1].url, "[?&]page="))
    end)

    it("inactive paging adds nothing", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "paging", options = { active = false } },
      }, server = rec.server })
      h.op({ op = "list", path = "/w" })
      assert.is_nil(string.find(rec.calls[1].url, "[?&]page="))
    end)
  end) end


  -- streaming ---------------------------------------------------------------
  if has_feature("streaming") then describe("streaming", function()

    it("streams list items", function()
      local clock = make_clock()
      local rec = recording_server(function()
        return make_response(200, { "a", "b", "c" })
      end)
      local h = make_client({ features = {
        { name = "streaming", options = { chunkDelay = 5, sleep = clock.sleep } },
      }, server = rec.server })
      local res = h.op({ op = "list", path = "/w" })
      assert.is_true(res.result.streaming)
      local seen = {}
      for item in res.result.stream() do
        table.insert(seen, item)
      end
      assert.are.same({ "a", "b", "c" }, seen)
      assert.are.equal(15, clock.time())
    end)

    it("batches with chunkSize", function()
      local rec = recording_server(function()
        return make_response(200, { 1, 2, 3, 4, 5 })
      end)
      local h = make_client({ features = {
        { name = "streaming", options = { chunkSize = 2 } },
      }, server = rec.server })
      local res = h.op({ op = "list", path = "/w" })
      local batches = {}
      for b in res.result.stream() do
        table.insert(batches, b)
      end
      assert.are.same({ { 1, 2 }, { 3, 4 }, { 5 } }, batches)
    end)

    it("non-list op is not streamed", function()
      local h = make_client({ features = { { name = "streaming" } } })
      local res = h.op({ op = "load" })
      assert.is_nil(res.result.streaming)
    end)

    it("inactive streaming attaches nothing", function()
      local rec = recording_server(function()
        return make_response(200, { "a" })
      end)
      local h = make_client({ features = {
        { name = "streaming", options = { active = false } },
      }, server = rec.server })
      local res = h.op({ op = "list", path = "/w" })
      assert.is_nil(res.result.streaming)
    end)
  end) end


  -- proxy ---------------------------------------------------------------
  if has_feature("proxy") then describe("proxy", function()

    it("routes through the proxy and invokes an agent factory", function()
      local rec = recording_server()
      local agent_url = ""
      local h = make_client({ features = {
        { name = "proxy", options = {
          url = "http://proxy:8080",
          agent = function(u) agent_url = u; return { a = 1 } end } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.are.equal("http://proxy:8080", rec.calls[1].fetchdef.proxy)
      assert.are.equal(1, rec.calls[1].fetchdef.dispatcher.a)
      assert.are.equal("http://proxy:8080", agent_url)
      assert.are.equal(1, h.client._proxy.routed)
    end)

    it("bypasses noProxy hosts", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "proxy", options = { url = "http://proxy:8080", noProxy = { "api.test" } } },
      }, server = rec.server, base = "http://api.test" })
      h.op({ op = "load" })
      assert.is_nil(rec.calls[1].fetchdef.proxy)
    end)

    it("inactive proxy does not wrap", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "proxy", options = { active = false, url = "http://proxy:8080" } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.is_nil(rec.calls[1].fetchdef.proxy)
    end)

    it("no url set is a no-op", function()
      local rec = recording_server()
      local h = make_client({ features = {
        { name = "proxy", options = {} },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.is_nil(rec.calls[1].fetchdef.proxy)
    end)

    it("fromEnv reads HTTPS_PROXY via the injectable getenv", function()
      local rec = recording_server()
      local env = { HTTPS_PROXY = "http://env-proxy:8080" }
      local h = make_client({ features = {
        { name = "proxy", options = {
          fromEnv = true, getenv = function(k) return env[k] end } },
      }, server = rec.server })
      h.op({ op = "load" })
      assert.are.equal("http://env-proxy:8080", rec.calls[1].fetchdef.proxy)
    end)
  end) end


  -- composition ---------------------------------------------------------
  if has_feature("cache") and has_feature("netsim") then
    it("cache + netsim: a hit skips the simulated failure", function()
      local h = make_client({ features = {
        { name = "netsim", options = { failEvery = 2 } },
        { name = "cache", options = { ttl = 10000 } },
      } })
      assert.is_true(h.op({ op = "load", path = "/w" }).ok)
      assert.is_true(h.op({ op = "load", path = "/w" }).ok)
      assert.are.equal(1, h.client._netsim.calls)
    end)
  end
end)
