-- ZefoyTiktokBot SDK pipeline test
--
-- Direct unit tests for the operation-pipeline utilities. The generated
-- entity tests exercise the happy path; these drive the error and edge
-- branches (missing spec/response/result, 4xx handling, transport
-- failures, feature ordering, auth header shaping) that a normal
-- success-path op never reaches. All utilities are reached through the
-- registered Utility type, so this suite is API-agnostic.
--
-- Adaptations from the TS suite (noted per case below):
-- - Lua utilities return `(value, err)` pairs instead of Error instances,
--   so error assertions check the second return value's `code`.
-- - `done`/`make_error` return errors rather than throwing.
-- - A body-parse exception test is inapplicable: the Lua `result_body`
--   calls `json_func` directly (transport json functions are plain Lua
--   closures, not deserialisers that can throw on re-read).

require("utility.register")

local vs = require("utility.struct.struct")
local Utility = require("core.utility_type")
local Context = require("core.context")
local Spec = require("core.spec")
local Result = require("core.result")
local Response = require("core.response")
local Operation = require("core.operation")
local BaseFeature = require("feature.base_feature")
local ZefoyTiktokBotError = require("core.error")


local ALLOW = {
  op = "load,list,create,update,remove",
  method = "GET,PUT,POST,PATCH,DELETE",
}


-- Transport-shaped response with a re-readable body + plain lowercase
-- header table.
local function transport_resp(status, data, headers)
  local h = {}
  for k, v in pairs(headers or {}) do
    h[string.lower(k)] = v
  end
  return {
    status = status,
    statusText = status < 400 and "OK" or "ERR",
    body = "body",
    json = function() return data end,
    headers = h,
  }
end


local function base_ctx(over)
  over = over or {}
  local ctx = Context.new({ opname = over.opname or "" }, nil)
  ctx.utility = over.utility or Utility.new()
  if over.client ~= nil then
    ctx.client = over.client
  end
  if over.op ~= nil then
    ctx.op = over.op
  end
  ctx.options = over.options or { allow = ALLOW }
  return ctx
end


describe("pipeline", function()

  describe("feature order", function()
    -- Feature #2: options.feature accepts an ordered LIST (developer add-order)
    -- or a map (defaults test-first); make_options records the resolved order
    -- in __derived__.featureorder.

    local function resolve(feature)
      local ctx = Context.new({}, nil)
      ctx.utility = Utility.new()
      ctx.options = { feature = feature }
      ctx.config = { options = {} }
      local opts = ctx.utility.make_options(ctx)
      return table.concat(opts["__derived__"].featureorder, ",")
    end

    it("map form is ordered test-first", function()
      assert.are.equal("test,metrics", resolve({
        metrics = { active = true },
        test = { active = true },
      }))
    end)

    it("list form preserves the explicit order", function()
      assert.are.equal("metrics,test", resolve({
        { name = "metrics", active = true },
        { name = "test", active = true },
      }))
    end)

    it("map form with no test orders deterministically", function()
      assert.are.equal("cache,retry", resolve({
        retry = { active = true },
        cache = { active = true },
      }))
    end)
  end)

  describe("makePoint + makeSpec", function()

    it("make_point rejects a disallowed operation", function()
      local ctx = base_ctx({
        op = Operation.new({ name = "nope" }),
        options = { allow = { op = "load" } },
      })
      local _, err = ctx.utility.make_point(ctx)
      assert.are.equal("point_op_allow", err.code)
    end)

    it("make_point rejects an operation with no endpoints", function()
      local ctx = base_ctx({ op = Operation.new({ name = "load" }) })
      local _, err = ctx.utility.make_point(ctx)
      assert.are.equal("point_no_points", err.code)
    end)

    it("make_point returns the single point", function()
      local point = { method = "GET", parts = { "a" } }
      local ctx = base_ctx({
        op = Operation.new({ name = "load", points = { point } }),
      })
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(err)
      assert.are.equal(point, out)
      assert.are.equal(point, ctx.point)
    end)

    it("make_point short-circuits a feature-supplied point", function()
      local preset = { method = "GET" }
      local ctx = base_ctx({})
      ctx.out["point"] = preset
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)

    it("make_point surfaces a feature-supplied error (rbac short-circuit)", function()
      local denial = ZefoyTiktokBotError.new("rbac_denied", "denied", nil)
      local ctx = base_ctx({})
      ctx.out["point"] = denial
      local out, err = ctx.utility.make_point(ctx)
      assert.is_nil(out)
      assert.are.equal("rbac_denied", err.code)
    end)

    it("make_spec short-circuits a feature-supplied spec", function()
      local preset = { method = "GET" }
      local ctx = base_ctx({})
      ctx.out["spec"] = preset
      local out, err = ctx.utility.make_spec(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
      assert.are.equal(preset, ctx.spec)
    end)
  end)


  describe("makeResponse", function()

    it("guards missing spec / response / result", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      ctx.response = Response.new({})
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_spec", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = nil
      ctx.result = Result.new({})
      _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_response", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new({})
      ctx.result = nil
      _, err = ctx.utility.make_response(ctx)
      assert.are.equal("response_no_result", err.code)
    end)

    it("a 4xx response sets result.err and copies headers", function()
      local ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(404, nil, { ["x-a"] = "1" }))
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.is_not_nil(ctx.result.err)
      assert.are.equal(404, ctx.result.status)
      assert.are.equal("1", ctx.result.headers["x-a"])
    end)

    it("a 2xx response parses the body and marks ok", function()
      local ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(200, { v = 1 }))
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.is_true(ctx.result.ok)
      assert.are.equal(1, ctx.result.body.v)
    end)

    it("records to ctrl.explain when explain is on", function()
      local ctx = base_ctx({})
      ctx.ctrl.explain = {}
      ctx.spec = Spec.new({ step = "s" })
      ctx.response = Response.new(transport_resp(200, { v = 2 }))
      ctx.result = Result.new({})
      ctx.utility.make_response(ctx)
      assert.is_not_nil(ctx.ctrl.explain["result"])
    end)

    it("short-circuits when a feature already supplied the response", function()
      local preset = Response.new(transport_resp(299))
      local ctx = base_ctx({})
      ctx.out["response"] = preset
      local out, err = ctx.utility.make_response(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeResult", function()

    it("guards missing spec / result", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      ctx.result = Result.new({})
      local _, err = ctx.utility.make_result(ctx)
      assert.are.equal("result_no_spec", err.code)

      ctx = base_ctx({})
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = nil
      _, err = ctx.utility.make_result(ctx)
      assert.are.equal("result_no_result", err.code)
    end)

    it("list op wraps resdata into entity instances", function()
      local made = {}
      local entity = {}
      function entity:make()
        local ent = {}
        function ent:data_set(d)
          table.insert(made, d)
        end
        return ent
      end

      local ctx = base_ctx({ opname = "list" })
      ctx.entity = entity
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = Result.new({ resdata = { { a = 1 }, { a = 2 } } })

      local r, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(2, #r.resdata)
      assert.are.equal(2, #made)
    end)

    it("an empty list yields an empty resdata table", function()
      local entity = {}
      function entity:make()
        local ent = {}
        function ent:data_set(_) end
        return ent
      end

      local ctx = base_ctx({ opname = "list" })
      ctx.entity = entity
      ctx.spec = Spec.new({ step = "s" })
      ctx.result = Result.new({ resdata = {} })

      local r, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(0, #r.resdata)
    end)

    it("short-circuits on a preset result", function()
      local preset = { ok = true }
      local ctx = base_ctx({})
      ctx.out["result"] = preset
      local out, err = ctx.utility.make_result(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeRequest", function()

    local function request_ctx(fetcher)
      local u = Utility.new()
      if fetcher ~= nil then
        u.fetcher = fetcher
      end
      local ctx = base_ctx({ utility = u })
      ctx.spec = Spec.new({
        step = "s",
        method = "GET",
        headers = {},
        base = "http://h",
        prefix = "",
        suffix = "",
        parts = { "a" },
      })
      return ctx
    end

    it("guards a missing spec", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      local _, err = ctx.utility.make_request(ctx)
      assert.are.equal("request_no_spec", err.code)
    end)

    it("a nil transport result becomes a response error", function()
      local ctx = request_ctx(function() return nil, nil end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.is_not_nil(r.err)
    end)

    it("a transport error is carried on the response", function()
      local boom = ZefoyTiktokBotError.new("boom", "boom", nil)
      local ctx = request_ctx(function() return nil, boom end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(boom, r.err)
    end)

    it("a normal transport response is wrapped", function()
      local ctx = request_ctx(function() return transport_resp(200, { a = 1 }), nil end)
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(200, r.status)
    end)

    it("records the fetchdef to ctrl.explain", function()
      local ctx = request_ctx(function() return transport_resp(200, {}), nil end)
      ctx.ctrl.explain = {}
      ctx.utility.make_request(ctx)
      assert.is_not_nil(ctx.ctrl.explain["fetchdef"])
    end)

    it("a fetchdef error surfaces as a response error", function()
      local ctx = request_ctx(nil)
      ctx.utility.make_fetch_def = function(_c)
        return nil, ZefoyTiktokBotError.new("fetchdef_boom", "boom", nil)
      end
      local r, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.is_not_nil(r.err)
      assert.are.equal("fetchdef_boom", r.err.code)
    end)

    it("short-circuits a feature-supplied request", function()
      local preset = Response.new(transport_resp(201))
      local ctx = base_ctx({})
      ctx.out["request"] = preset
      local out, err = ctx.utility.make_request(ctx)
      assert.is_nil(err)
      assert.are.equal(preset, out)
    end)
  end)


  describe("makeFetchDef", function()

    it("guards a missing spec", function()
      local ctx = base_ctx({})
      ctx.spec = nil
      local _, err = ctx.utility.make_fetch_def(ctx)
      assert.are.equal("fetchdef_no_spec", err.code)
    end)

    it("serialises a table body to JSON and inits a missing result", function()
      local ctx = base_ctx({})
      ctx.result = nil
      ctx.spec = Spec.new({
        step = "s",
        method = "POST",
        headers = {},
        base = "http://h",
        prefix = "",
        suffix = "",
        parts = { "a" },
        body = { x = 1 },
      })
      local fd, err = ctx.utility.make_fetch_def(ctx)
      assert.is_nil(err)
      assert.are.equal("string", type(fd["body"]))
      assert.is_truthy(string.find(fd["url"], "http://h", 1, true))
      assert.is_not_nil(ctx.result) -- result was lazily created
    end)
  end)


  describe("makeError + done", function()

    it("done returns resdata on success", function()
      local ctx = base_ctx({})
      ctx.result = Result.new({ ok = true, resdata = 42 })
      local out, err = ctx.utility.done(ctx)
      assert.is_nil(err)
      assert.are.equal(42, out)
    end)

    -- Adapted: the Lua pipeline returns the error (no throw semantics).
    it("done returns the error when not ok", function()
      local ctx = base_ctx({})
      ctx.result = Result.new({ ok = false })
      local out, err = ctx.utility.done(ctx)
      assert.is_nil(out)
      assert.is_not_nil(err)
    end)

    it("done cleans ctrl.explain on success", function()
      local ctx = base_ctx({})
      ctx.ctrl.explain = { result = { err = "x" } }
      ctx.result = Result.new({ ok = true, resdata = 7 })
      local out = ctx.utility.done(ctx)
      assert.are.equal(7, out)
      assert.is_nil(ctx.ctrl.explain["result"]["err"])
    end)

    it("make_error returns resdata instead of erroring when throw is off", function()
      local ctx = base_ctx({})
      ctx.ctrl.throw_err = false
      ctx.result = Result.new({ ok = false, resdata = "fallback" })
      local out, err = ctx.utility.make_error(ctx, nil)
      assert.is_nil(err)
      assert.are.equal("fallback", out)
    end)

    it("make_error records to ctrl.explain", function()
      local ctx = base_ctx({})
      ctx.ctrl.throw_err = false
      ctx.ctrl.explain = {}
      ctx.result = Result.new({ ok = false })
      ctx.utility.make_error(ctx, nil)
      assert.is_not_nil(ctx.ctrl.explain["err"])
    end)

    it("make_error fires the PreUnexpected hook", function()
      local fired = 0
      local feat = BaseFeature.new()
      feat.PreUnexpected = function(_self, _ctx)
        fired = fired + 1
      end
      local client = { features = { feat } }
      local ctx = base_ctx({ client = client })
      ctx.result = Result.new({ ok = false })
      local _, err = ctx.utility.make_error(ctx,
        ZefoyTiktokBotError.new("x", "boom", nil))
      assert.is_not_nil(err)
      assert.are.equal(1, fired)
      assert.is_not_nil(ctx.ctrl.err)
    end)
  end)


  describe("feature ordering", function()

    it("feature_add appends to the client feature list", function()
      local client = { features = { { name = "a" }, { name = "b" } } }
      local ctx = { client = client }
      local u = Utility.new()
      u.feature_add(ctx, { name = "z" })
      local names = {}
      for _, f in ipairs(client.features) do
        table.insert(names, f.name)
      end
      assert.are.equal("a,b,z", table.concat(names, ","))
    end)

    -- `_options` on an extend-feature instance positions it relative to an
    -- already-added feature (mirrors the ts featureAdd).
    it("feature_add honours __before__/__after__/__replace__", function()
      local client = { features = {} }
      local ctx = { client = client }
      local u = Utility.new()
      local function names()
        local out = {}
        for _, f in ipairs(client.features) do
          table.insert(out, f.name)
        end
        return table.concat(out, ",")
      end

      u.feature_add(ctx, { name = "a" })
      u.feature_add(ctx, { name = "b" })
      assert.are.equal("a,b", names())

      u.feature_add(ctx, { name = "z1", _options = { __before__ = "b" } })
      assert.are.equal("a,z1,b", names())

      u.feature_add(ctx, { name = "z2", _options = { __after__ = "a" } })
      assert.are.equal("a,z2,z1,b", names())

      u.feature_add(ctx, { name = "z3", _options = { __replace__ = "z1" } })
      assert.are.equal("a,z2,z3,b", names())

      -- An ordering option naming no existing feature falls back to append.
      u.feature_add(ctx, { name = "z4", _options = { __before__ = "missing" } })
      assert.are.equal("a,z2,z3,b,z4", names())
    end)

    it("feature_hook fires hooks in feature-list order", function()
      local order = {}
      local function recorder(name)
        local f = BaseFeature.new()
        f.PreRequest = function(_self, _ctx)
          table.insert(order, name)
        end
        return f
      end
      local client = { features = { recorder("a"), recorder("z") } }
      local u = Utility.new()
      u.feature_hook({ client = client }, "PreRequest")
      assert.are.equal("a,z", table.concat(order, ","))
    end)
  end)


  describe("prepareAuth", function()

    -- Fake client so the exact options.auth / apikey shape is controlled.
    local function auth_ctx(options, headers)
      local ctx = base_ctx({})
      ctx.client = {
        options_map = function(_self)
          return options
        end,
      }
      if headers == nil then
        ctx.spec = nil
      else
        ctx.spec = Spec.new({ headers = headers })
      end
      return ctx
    end

    it("guards a missing spec", function()
      local ctx = auth_ctx({ auth = { prefix = "" }, apikey = "K" }, nil)
      local _, err = ctx.utility.prepare_auth(ctx)
      assert.are.equal("auth_no_spec", err.code)
    end)

    it("an apikey with a prefix is space-joined", function()
      local ctx = auth_ctx({ apikey = "K", auth = { prefix = "Bearer" } }, {})
      ctx.utility.prepare_auth(ctx)
      assert.are.equal("Bearer K", ctx.spec.headers["authorization"])
    end)

    it("a raw apikey (empty prefix) goes in as-is", function()
      local ctx = auth_ctx({ apikey = "K", auth = { prefix = "" } }, {})
      ctx.utility.prepare_auth(ctx)
      assert.are.equal("K", ctx.spec.headers["authorization"])
    end)

    it("an empty apikey drops the header", function()
      local ctx = auth_ctx({ apikey = "", auth = { prefix = "Bearer" } },
        { authorization = "stale" })
      ctx.utility.prepare_auth(ctx)
      assert.is_nil(ctx.spec.headers["authorization"])
    end)

    it("a public API (no auth block) drops the header", function()
      local ctx = auth_ctx({ apikey = "K" }, { authorization = "stale" })
      ctx.utility.prepare_auth(ctx)
      assert.is_nil(ctx.spec.headers["authorization"])
    end)

    it("a missing apikey option drops the header", function()
      local ctx = auth_ctx({ auth = { prefix = "Bearer" } },
        { authorization = "stale" })
      ctx.utility.prepare_auth(ctx)
      assert.is_nil(ctx.spec.headers["authorization"])
    end)
  end)


  describe("result helpers", function()

    it("result_headers with non-table headers yields an empty map", function()
      local ctx = base_ctx({})
      ctx.response = Response.new({ headers = "x" })
      ctx.result = Result.new({})
      ctx.utility.result_headers(ctx)
      assert.are.same({}, ctx.result.headers)
    end)

    it("result_body skips parsing when the body is absent", function()
      local ctx = base_ctx({})
      ctx.response = Response.new({ json = function() return { a = 1 } end })
      ctx.result = Result.new({})
      ctx.utility.result_body(ctx)
      assert.is_nil(ctx.result.body)
    end)
  end)
end)
