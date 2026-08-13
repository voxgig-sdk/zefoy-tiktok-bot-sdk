-- ZefoyTiktokBot SDK primary utility test

local json = require("dkjson")
local vs = require("utility.struct.struct")
local sdk = require("zefoy-tiktok-bot_sdk")
local helpers = require("core.helpers")
local runner = require("test.runner")
local Context = require("core.context")
local Spec = require("core.spec")
local Result = require("core.result")
local Response = require("core.response")
local Operation = require("core.operation")
local BaseFeature = require("feature.base_feature")
local ZefoyTiktokBotError = require("core.error")

local _test_dir = debug.getinfo(1, "S").source:match("^@(.+/)") or "./"


-- Load test.json
local function load_test_spec()
  local path = _test_dir .. "../../.sdk/test/test.json"
  local f = io.open(path, "r")
  if f == nil then
    error("failed to load test.json: " .. path)
  end
  local content = f:read("*a")
  f:close()
  local spec = json.decode(content)
  if spec == nil then
    error("failed to parse test.json")
  end
  return spec
end


-- Navigate into nested map by keys
local function get_spec(spec, ...)
  local cur = spec
  local keys = {...}
  for _, key in ipairs(keys) do
    if type(cur) ~= "table" then
      return nil
    end
    cur = cur[key]
  end
  if type(cur) == "table" then
    return cur
  end
  return nil
end


-- JSON normalize: round-trip through JSON to normalize types
local function json_normalize(val)
  if val == nil then
    return nil
  end
  local encoded = json.encode(val)
  if encoded == nil then
    return val
  end
  local decoded = json.decode(encoded)
  return decoded
end


-- JSON string representation
local function json_str(val)
  if val == nil then
    return "nil"
  end
  local encoded = json.encode(val)
  if encoded == nil then
    return tostring(val)
  end
  return encoded
end


-- Match a string pattern: /regex/ or case-insensitive contains
-- Converts common PCRE patterns (\w, \d, \s) to Lua patterns (%w, %d, %s)
local function match_string(pattern, val)
  if #pattern >= 2 and pattern:sub(1, 1) == "/" and pattern:sub(-1) == "/" then
    local re = pattern:sub(2, -2)
    -- Convert PCRE character classes to Lua pattern equivalents
    re = re:gsub("\\w", "%%w")
    re = re:gsub("\\d", "%%d")
    re = re:gsub("\\s", "%%s")
    local ok = string.find(val, re)
    return ok ~= nil
  end
  return string.find(string.lower(val), string.lower(pattern), 1, true) ~= nil
end


-- Deep match: check that all keys in 'check' exist and match in 'base'
local function match_deep(check, base, path, errors)
  if check == nil then
    return
  end

  path = path or ""
  errors = errors or {}

  if type(check) == "table" then
    -- Determine if check is a list (array) or map
    local is_list = false
    if #check > 0 then
      is_list = true
      for k, _ in pairs(check) do
        if type(k) ~= "number" then
          is_list = false
          break
        end
      end
    end

    if is_list then
      for i, check_val in ipairs(check) do
        local child_path = path .. "[" .. i .. "]"
        local base_val = nil
        if type(base) == "table" and base[i] ~= nil then
          base_val = base[i]
        end
        match_deep(check_val, base_val, child_path, errors)
      end
    else
      for key, check_val in pairs(check) do
        local child_path = path .. "." .. tostring(key)
        local base_val = nil
        if type(base) == "table" then
          base_val = base[key]
        end
        match_deep(check_val, base_val, child_path, errors)
      end
    end
  else
    local check_str = nil
    if type(check) == "string" then
      check_str = check
    end

    if check_str == "__EXISTS__" then
      if base == nil then
        table.insert(errors, "match " .. path .. ": expected value to exist but got nil")
      end
      return
    end

    if check_str == "__UNDEF__" then
      if base ~= nil then
        table.insert(errors, "match " .. path .. ": expected nil but got " .. json_str(base))
      end
      return
    end

    local norm_check = json_normalize(check)
    local norm_base = json_normalize(base)

    -- Compare normalized values
    local check_json = json.encode(norm_check)
    local base_json = json.encode(norm_base)

    if check_json ~= base_json then
      if check_str ~= nil and check_str ~= "" then
        local base_str = tostring(base or "")
        if match_string(check_str, base_str) then
          return
        end
      end
      table.insert(errors, "match " .. path .. ": got " ..
        json_str(norm_base) .. ", want " .. json_str(norm_check))
    end
  end
end


-- Run a test set from test.json
local function runset(testspec, subject)
  if testspec == nil then
    return
  end
  local set = testspec["set"]
  if type(set) ~= "table" then
    return
  end

  for si, entry_ref in ipairs(set) do
    local i = si - 1
    local entry = entry_ref

    local mark = ""
    if entry["mark"] ~= nil then
      mark = " (mark=" .. tostring(entry["mark"]) .. ")"
    end

    local result, err = subject(entry)

    local expected_err = entry["err"]

    if err ~= nil then
      if expected_err ~= nil then
        local err_msg = tostring(err)
        if type(err) == "table" and err.msg ~= nil then
          err_msg = err.msg
        end
        if type(expected_err) == "string" then
          if not match_string(expected_err, err_msg) then
            error("entry " .. i .. mark .. ": error mismatch: got " ..
              json_str(err_msg) .. ", want contains " .. json_str(expected_err))
          end
        elseif type(expected_err) == "boolean" and expected_err == true then
          -- err: true means any error is acceptable
        end
        if entry["match"] ~= nil then
          local result_map = {
            ["in"] = entry["in"],
            out = json_normalize(result),
            err = { message = tostring(err) },
          }
          local errors = {}
          match_deep(entry["match"], result_map, "", errors)
          if #errors > 0 then
            error("entry " .. i .. mark .. ": " .. table.concat(errors, "; "))
          end
        end
        goto continue
      end
      error("entry " .. i .. mark .. ": unexpected error: " .. tostring(err))
    end

    if expected_err ~= nil then
      error("entry " .. i .. mark .. ": expected error containing " ..
        json_str(expected_err) .. " but got result: " .. json_str(result))
    end

    do
      local matched = false
      if entry["match"] ~= nil then
        local result_map = {
          ["in"] = entry["in"],
          out = json_normalize(result),
        }
        if entry["args"] ~= nil then
          result_map["args"] = entry["args"]
        elseif entry["in"] ~= nil then
          result_map["args"] = { entry["in"] }
        end
        if entry["ctx"] ~= nil then
          result_map["ctx"] = entry["ctx"]
        end
        local errors = {}
        match_deep(entry["match"], result_map, "", errors)
        if #errors > 0 then
          error("entry " .. i .. mark .. ": " .. table.concat(errors, "; "))
        end
        matched = true
      end

      local expected_out = entry["out"]
      if expected_out == nil and matched then
        goto continue
      end
      if expected_out ~= nil then
        local norm_result = json_normalize(result)
        local norm_expected = json_normalize(expected_out)
        local rj = json.encode(norm_result)
        local ej = json.encode(norm_expected)
        -- Treat empty [] and {} as equivalent
        local rj_norm = (rj == "[]") and "{}" or rj
        local ej_norm = (ej == "[]") and "{}" or ej
        if rj_norm ~= ej_norm then
          error("entry " .. i .. mark .. ": output mismatch: got " ..
            json_str(norm_result) .. ", want " .. json_str(norm_expected))
        end
      end
    end

    ::continue::
  end
end


-- Create a context from a JSON map (like makeCtxFromMap in Go)
local function make_ctx_from_map(ctxmap, client, utility)
  if ctxmap == nil then
    ctxmap = {}
  end

  local ctx = Context.new(ctxmap, nil)

  if client ~= nil then
    ctx.client = client
    ctx.utility = utility
  end
  if ctx.options == nil and client ~= nil then
    ctx.options = client:options_map()
  end

  -- Handle spec from JSON map
  if type(ctxmap["spec"]) == "table" then
    ctx.spec = Spec.new(ctxmap["spec"])
  end

  -- Handle result from JSON map
  if type(ctxmap["result"]) == "table" then
    local resmap = ctxmap["result"]
    ctx.result = Result.new(resmap)
    if type(resmap["err"]) == "table" then
      local msg = resmap["err"]["message"]
      if type(msg) == "string" then
        ctx.result.err = ZefoyTiktokBotError.new("", msg, nil)
      end
    end
  end

  -- Handle response from JSON map
  if type(ctxmap["response"]) == "table" then
    local respmap = ctxmap["response"]
    ctx.response = Response.new(respmap)
    if respmap["body"] ~= nil then
      local body_copy = respmap["body"]
      ctx.response.json_func = function() return body_copy end
    end
    if type(respmap["headers"]) == "table" then
      local lower_headers = {}
      for k, v in pairs(respmap["headers"]) do
        lower_headers[string.lower(k)] = v
      end
      ctx.response.headers = lower_headers
    end
  end

  return ctx
end


-- Fix context options
local function fixctx(ctx, client)
  if ctx ~= nil and ctx.client ~= nil and ctx.options == nil then
    ctx.options = ctx.client:options_map()
  end
end


-- Create an error from a JSON map
local function err_from_map(m)
  if m == nil then
    return nil
  end
  local msg = m["message"]
  if type(msg) ~= "string" or msg == "" then
    return nil
  end
  local code = m["code"] or ""
  return ZefoyTiktokBotError.new(code, msg, nil)
end


-- Create a basic test context
local function make_test_ctx(client, utility, overrides)
  local ctxmap = {
    opname = "load",
    client = client,
    utility = utility,
  }
  if overrides ~= nil then
    for k, v in pairs(overrides) do
      ctxmap[k] = v
    end
  end
  return utility.make_context(ctxmap, client:get_root_ctx())
end


-- Create a full test context with point and match
local function make_test_full_ctx(client, utility)
  local ctx = make_test_ctx(client, utility, nil)
  ctx.point = {
    parts = { "items", "{id}" },
    args = { params = { { name = "id", reqd = true } } },
    params = { "id" },
    alias = {},
    select = {},
    active = true,
    transform = {},
  }
  ctx.match = { id = "item01" }
  ctx.reqmatch = { id = "item01" }
  return ctx
end


describe("PrimaryUtility", function()
  local spec = load_test_spec()
  local primary = get_spec(spec, "primary")
  assert.is_not_nil(primary, "primary section not found in test.json")

  local client = sdk.test(nil, nil)
  local utility = client:get_utility()


  it("exists", function()
    assert.is_not_nil(utility.clean, "clean should not be nil")
    assert.is_not_nil(utility.done, "done should not be nil")
    assert.is_not_nil(utility.make_error, "make_error should not be nil")
    assert.is_not_nil(utility.feature_add, "feature_add should not be nil")
    assert.is_not_nil(utility.feature_hook, "feature_hook should not be nil")
    assert.is_not_nil(utility.feature_init, "feature_init should not be nil")
    assert.is_not_nil(utility.fetcher, "fetcher should not be nil")
    assert.is_not_nil(utility.make_fetch_def, "make_fetch_def should not be nil")
    assert.is_not_nil(utility.make_context, "make_context should not be nil")
    assert.is_not_nil(utility.make_options, "make_options should not be nil")
    assert.is_not_nil(utility.make_request, "make_request should not be nil")
    assert.is_not_nil(utility.make_response, "make_response should not be nil")
    assert.is_not_nil(utility.make_result, "make_result should not be nil")
    assert.is_not_nil(utility.make_point, "make_point should not be nil")
    assert.is_not_nil(utility.make_spec, "make_spec should not be nil")
    assert.is_not_nil(utility.make_url, "make_url should not be nil")
    assert.is_not_nil(utility.param, "param should not be nil")
    assert.is_not_nil(utility.prepare_auth, "prepare_auth should not be nil")
    assert.is_not_nil(utility.prepare_body, "prepare_body should not be nil")
    assert.is_not_nil(utility.prepare_headers, "prepare_headers should not be nil")
    assert.is_not_nil(utility.prepare_method, "prepare_method should not be nil")
    assert.is_not_nil(utility.prepare_params, "prepare_params should not be nil")
    assert.is_not_nil(utility.prepare_path, "prepare_path should not be nil")
    assert.is_not_nil(utility.prepare_query, "prepare_query should not be nil")
    assert.is_not_nil(utility.result_basic, "result_basic should not be nil")
    assert.is_not_nil(utility.result_body, "result_body should not be nil")
    assert.is_not_nil(utility.result_headers, "result_headers should not be nil")
    assert.is_not_nil(utility.transform_request, "transform_request should not be nil")
    assert.is_not_nil(utility.transform_response, "transform_response should not be nil")
  end)


  it("clean-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local val = { key = "secret123", name = "test" }
    local cleaned = utility.clean(ctx, val)
    assert.is_not_nil(cleaned, "cleaned should not be nil")
  end)


  it("done-basic", function()
    runset(get_spec(primary, "done", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      fixctx(ctx, client)
      return utility.done(ctx)
    end)
  end)


  it("makeError-basic", function()
    runset(get_spec(primary, "makeError", "basic"), function(entry)
      local args = entry["args"]
      if type(args) ~= "table" or #args == 0 then
        args = { {} }
      end

      local ctxmap = args[1]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      fixctx(ctx, client)

      local err_val = nil
      if #args > 1 then
        if type(args[2]) == "table" then
          err_val = err_from_map(args[2])
        end
      end

      return utility.make_error(ctx, err_val)
    end)
  end)


  it("makeError-no-throw", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.ctrl.throw_err = false
    ctx.result = Result.new({
      ok = false,
      resdata = { id = "safe01" },
    })

    local out, err = utility.make_error(ctx, ctx:make_error("test_code", "test message"))
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(out, "expected result")
    if type(out) == "table" then
      assert.are.equal("safe01", out["id"])
    else
      error("expected table result, got: " .. type(out))
    end
  end)


  it("featureAdd-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local start_len = #client.features

    local feature = BaseFeature.new()
    utility.feature_add(ctx, feature)

    assert.are.equal(start_len + 1, #client.features)
  end)


  it("featureHook-basic", function()
    local hook_client = sdk.test(nil, nil)
    local hook_utility = hook_client:get_utility()
    local ctx = make_test_ctx(hook_client, hook_utility, nil)

    local called = false
    local hook_feature = BaseFeature.new()
    hook_feature.TestHook = function(self_feat, hook_ctx)
      called = true
    end
    hook_client.features = { hook_feature }

    hook_utility.feature_hook(ctx, "TestHook")
    assert.is_true(called, "expected TestHook to be called")
  end)


  it("featureInit-basic", function()
    local init_client = sdk.test(nil, nil)
    local init_utility = init_client:get_utility()
    local ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      initfeat = { active = true },
    }

    local init_called = false
    local feature = BaseFeature.new()
    feature.name = "initfeat"
    feature.active = true
    feature.get_name = function(self_feat) return "initfeat" end
    feature.get_active = function(self_feat) return true end
    feature.init = function(self_feat, init_ctx, options)
      init_called = true
    end

    init_utility.feature_init(ctx, feature)
    assert.is_true(init_called, "expected init to be called")
  end)


  it("featureInit-inactive", function()
    local init_client = sdk.test(nil, nil)
    local init_utility = init_client:get_utility()
    local ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      nofeat = { active = false },
    }

    local init_called = false
    local feature = BaseFeature.new()
    feature.name = "nofeat"
    feature.active = false
    feature.get_name = function(self_feat) return "nofeat" end
    feature.get_active = function(self_feat) return false end
    feature.init = function(self_feat, init_ctx, options)
      init_called = true
    end

    init_utility.feature_init(ctx, feature)
    assert.is_false(init_called, "expected init NOT to be called for inactive feature")
  end)


  it("fetcher-live", function()
    local calls = {}
    local live_client = sdk.new({
      -- Concrete base: a live construction must satisfy any server variables
      -- a templated base URL declares; a literal base sidesteps the requirement.
      base = "http://localhost:8080",
      system = {
        fetch = function(url, fetchdef)
          table.insert(calls, { url = url, init = fetchdef })
          return { status = 200, statusText = "OK" }, nil
        end,
      },
    })
    local live_utility = live_client:get_utility()
    local ctx = live_utility.make_context({
      opname = "load",
      client = live_client,
      utility = live_utility,
    }, nil)

    local fetchdef = { method = "GET", headers = {} }
    local _, err = live_utility.fetcher(ctx, "http://example.com/test", fetchdef)
    assert.is_nil(err, "expected no error")
    assert.are.equal(1, #calls)
    assert.are.equal("http://example.com/test", calls[1]["url"])
  end)


  it("fetcher-blocked-test-mode", function()
    local blocked_client = sdk.new({
      base = "http://localhost:8080",
      system = {
        fetch = function(url, fetchdef)
          return {}, nil
        end,
      },
    })
    blocked_client.mode = "test"

    local blocked_utility = blocked_client:get_utility()
    local ctx = blocked_utility.make_context({
      opname = "load",
      client = blocked_client,
      utility = blocked_utility,
    }, nil)

    local fetchdef = { method = "GET", headers = {} }
    local _, err = blocked_utility.fetcher(ctx, "http://example.com/test", fetchdef)
    assert.is_not_nil(err, "expected error for test mode fetch")
    local err_msg = tostring(err)
    if type(err) == "table" and err.msg ~= nil then
      err_msg = err.msg
    end
    assert.is_truthy(string.find(err_msg, "blocked"),
      "expected error containing 'blocked', got: " .. err_msg)
  end)


  it("makeContext-basic", function()
    runset(get_spec(primary, "makeContext", "basic"), function(entry)
      local in_val = entry["in"]
      if type(in_val) == "table" then
        local ctx = utility.make_context(in_val, nil)
        local out = {
          id = ctx.id,
        }
        if ctx.op ~= nil then
          out["op"] = {
            name = ctx.op.name,
            input = ctx.op.input,
          }
        end
        return out, nil
      end
      return nil, nil
    end)
  end)


  it("makeFetchDef-basic", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "/api",
      path = "items/{id}",
      suffix = "",
      params = { id = "item01" },
      query = {},
      headers = { ["content-type"] = "application/json" },
      method = "GET",
      step = "start",
    })
    ctx.result = Result.new({})

    local fetchdef, err = utility.make_fetch_def(ctx)
    assert.is_nil(err, "should not be error")
    assert.is_not_nil(fetchdef, "fetchdef should not be nil")
    assert.are.equal("GET", fetchdef["method"])
    local url = fetchdef["url"] or ""
    assert.is_truthy(string.find(url, "/api/items/item01", 1, true),
      "expected url to contain /api/items/item01, got " .. url)
    assert.are.equal("application/json", fetchdef["headers"]["content-type"])
    assert.is_nil(fetchdef["body"], "expected nil body")
  end)


  it("makeFetchDef-with-body", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "",
      path = "items",
      suffix = "",
      params = {},
      query = {},
      headers = {},
      method = "POST",
      step = "start",
      body = { name = "test" },
    })
    ctx.result = Result.new({})

    local fetchdef, err = utility.make_fetch_def(ctx)
    assert.is_nil(err, "should not be error")
    assert.is_not_nil(fetchdef, "fetchdef should not be nil")
    assert.are.equal("POST", fetchdef["method"])
    local body_str = fetchdef["body"]
    assert.is_not_nil(body_str, "expected body")
    assert.are.equal("string", type(body_str))
    assert.is_truthy(string.find(body_str, '"name"', 1, true),
      "expected body to contain name, got " .. tostring(body_str))
  end)


  it("makeOptions-basic", function()
    runset(get_spec(primary, "makeOptions", "basic"), function(entry)
      local in_val = entry["in"]
      if type(in_val) ~= "table" then
        in_val = {}
      end
      local ctx = utility.make_context({
        options = in_val["options"],
        config = in_val["config"],
      }, nil)
      ctx.client = client
      ctx.utility = utility
      return utility.make_options(ctx), nil
    end)
  end)


  it("makeRequest-basic", function()
    runset(get_spec(primary, "makeRequest", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      ctx.options = client:options_map()

      local _, err = utility.make_request(ctx)
      if err ~= nil then
        return nil, err
      end

      -- Update entry ctx for match checking
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" then
        if ctx.response ~= nil then
          entry_ctx["response"] = "exists"
        end
        if ctx.result ~= nil then
          entry_ctx["result"] = "exists"
        end
      end

      return nil, nil
    end)
  end)


  it("makeResponse-basic", function()
    runset(get_spec(primary, "makeResponse", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      fixctx(ctx, client)

      local _, err = utility.make_response(ctx)
      if err ~= nil then
        return nil, err
      end

      -- Update entry ctx for match checking with result data
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.result ~= nil then
        entry_ctx["result"] = {
          ok = ctx.result.ok,
          status = ctx.result.status,
          statusText = ctx.result.status_text,
          headers = ctx.result.headers,
          body = ctx.result.body,
        }
      end

      return nil, nil
    end)
  end)


  it("makeResult-basic", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({
      base = "http://localhost:8080",
      prefix = "/api",
      path = "items/{id}",
      suffix = "",
      params = { id = "item01" },
      query = {},
      headers = {},
      method = "GET",
      step = "start",
    })
    ctx.result = Result.new({
      ok = true,
      status = 200,
      statusText = "OK",
      headers = {},
      resdata = { id = "item01", name = "Test" },
    })

    local result, err = utility.make_result(ctx)
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(result, "expected result")
    assert.are.equal(200, result.status)
  end)


  it("makeResult-no-spec", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = nil
    ctx.result = Result.new({
      ok = true,
      status = 200,
      statusText = "OK",
      headers = {},
    })

    local _, err = utility.make_result(ctx)
    assert.is_not_nil(err, "expected error for nil spec")
  end)


  it("makeResult-no-result", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.spec = Spec.new({ step = "start" })
    ctx.result = nil

    local _, err = utility.make_result(ctx)
    assert.is_not_nil(err, "expected error for nil result")
  end)


  it("makeSpec-basic", function()
    local setup_opts = get_spec(primary, "makeSpec", "DEF", "setup", "a")
    local spec_client = sdk.test(nil, setup_opts)
    local spec_utility = spec_client:get_utility()

    runset(get_spec(primary, "makeSpec", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, spec_client, spec_utility)
      ctx.options = spec_client:options_map()

      local _, err = utility.make_spec(ctx)
      if err ~= nil then
        return nil, err
      end

      -- Update entry ctx for match
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.spec ~= nil then
        entry_ctx["spec"] = {
          base = ctx.spec.base,
          prefix = ctx.spec.prefix,
          suffix = ctx.spec.suffix,
          method = ctx.spec.method,
          params = ctx.spec.params,
          query = ctx.spec.query,
          headers = ctx.spec.headers,
          step = ctx.spec.step,
        }
      end

      return nil, nil
    end)
  end)


  it("makePoint-basic", function()
    local ctx = make_test_ctx(client, utility, nil)
    local point = {
      parts = { "items", "{id}" },
      args = { params = {} },
      params = {},
      alias = {},
      select = {},
      active = true,
      transform = {},
    }
    ctx.op.points = { point }

    local _, err = utility.make_point(ctx)
    assert.is_nil(err, "expected no error")
    assert.is_not_nil(ctx.point, "expected point to be set")
  end)


  it("makeUrl-basic", function()
    runset(get_spec(primary, "makeUrl", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      if ctx.result == nil then
        ctx.result = Result.new({})
      end
      return utility.make_url(ctx)
    end)
  end)


  it("operator-basic", function()
    runset(get_spec(primary, "operator", "basic"), function(entry)
      local in_val = entry["in"]
      if type(in_val) ~= "table" then
        in_val = {}
      end
      local op = Operation.new(in_val)
      return {
        entity = op.entity,
        name = op.name,
        input = op.input,
        points = op.points,
      }, nil
    end)
  end)


  it("param-basic", function()
    runset(get_spec(primary, "param", "basic"), function(entry)
      local args = entry["args"]
      if type(args) ~= "table" or #args < 2 then
        return nil, nil
      end

      local ctxmap = args[1]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      local paramdef = args[2]

      local result = utility.param(ctx, paramdef)

      -- Update entry ctx for match
      if type(entry["match"]) == "table" then
        local ctx_match = entry["match"]["ctx"]
        if type(ctx_match) == "table" then
          local entry_ctx = entry["ctx"]
          if entry_ctx == nil then
            entry_ctx = {}
            entry["ctx"] = entry_ctx
          end
          -- Copy spec alias back to entry ctx for matching
          local spec_match = ctx_match["spec"]
          if type(spec_match) == "table" then
            if ctx.spec ~= nil then
              if entry_ctx["spec"] == nil then
                entry_ctx["spec"] = {}
              end
              local alias_match = spec_match["alias"]
              if type(alias_match) == "table" then
                entry_ctx["spec"] = {
                  alias = ctx.spec.alias,
                }
              end
            end
          end
        end
      end

      return result, nil
    end)
  end)


  it("prepareAuth-basic", function()
    local setup_opts = get_spec(primary, "prepareAuth", "DEF", "setup", "a")
    local auth_client = sdk.test(nil, setup_opts)
    local auth_utility = auth_client:get_utility()

    runset(get_spec(primary, "prepareAuth", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, auth_client, auth_utility)
      fixctx(ctx, auth_client)

      local _, err = utility.prepare_auth(ctx)
      if err ~= nil then
        return nil, err
      end

      -- Update entry ctx for match
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.spec ~= nil then
        entry_ctx["spec"] = {
          headers = ctx.spec.headers,
        }
      end

      return nil, nil
    end)
  end)


  it("prepareBody-basic", function()
    runset(get_spec(primary, "prepareBody", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      fixctx(ctx, client)
      return utility.prepare_body(ctx), nil
    end)
  end)


  it("prepareHeaders-basic", function()
    runset(get_spec(primary, "prepareHeaders", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      return utility.prepare_headers(ctx), nil
    end)
  end)


  it("prepareMethod-basic", function()
    runset(get_spec(primary, "prepareMethod", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      return utility.prepare_method(ctx), nil
    end)
  end)


  it("prepareParams-basic", function()
    runset(get_spec(primary, "prepareParams", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      return utility.prepare_params(ctx), nil
    end)
  end)


  it("preparePath-basic", function()
    -- Was hand-written cases that had drifted out of the shared corpus
    -- (the preparePath fixture shipped as an empty `set: []`).
    runset(get_spec(primary, "preparePath", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      return utility.prepare_path(ctx), nil
    end)
  end)


  it("preparePath-single", function()
    local ctx = make_test_full_ctx(client, utility)
    ctx.point = {
      parts = { "items" },
      args = { params = {} },
    }

    local path = utility.prepare_path(ctx)
    assert.are.equal("items", path)
  end)


  it("prepareQuery-basic", function()
    runset(get_spec(primary, "prepareQuery", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      return utility.prepare_query(ctx), nil
    end)
  end)


  it("resultBasic-basic", function()
    runset(get_spec(primary, "resultBasic", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)
      fixctx(ctx, client)

      local result = utility.result_basic(ctx)

      local out = {
        status = result.status,
        statusText = result.status_text,
      }
      if result.err ~= nil then
        local err_msg = tostring(result.err)
        if type(result.err) == "table" and result.err.msg ~= nil then
          err_msg = result.err.msg
        end
        out["err"] = {
          message = err_msg,
        }
      end

      return out, nil
    end)
  end)


  it("resultBody-basic", function()
    runset(get_spec(primary, "resultBody", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)

      utility.result_body(ctx)

      -- Update entry ctx for match
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.result ~= nil then
        entry_ctx["result"] = {
          body = ctx.result.body,
        }
      end

      return nil, nil
    end)
  end)


  it("resultHeaders-basic", function()
    runset(get_spec(primary, "resultHeaders", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)

      utility.result_headers(ctx)

      -- Update entry ctx for match
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.result ~= nil then
        entry_ctx["result"] = {
          headers = ctx.result.headers,
        }
      end

      return nil, nil
    end)
  end)


  it("transformRequest-basic", function()
    runset(get_spec(primary, "transformRequest", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)

      local result = utility.transform_request(ctx)

      -- Update entry ctx for match (step changed)
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.spec ~= nil then
        local spec_map = entry_ctx["spec"]
        if type(spec_map) == "table" then
          spec_map["step"] = ctx.spec.step
        end
      end

      return result, nil
    end)
  end)


  it("transformResponse-basic", function()
    runset(get_spec(primary, "transformResponse", "basic"), function(entry)
      local ctxmap = entry["ctx"]
      if type(ctxmap) ~= "table" then
        ctxmap = {}
      end
      local ctx = make_ctx_from_map(ctxmap, client, utility)

      local result = utility.transform_response(ctx)

      -- Update entry ctx for match (step changed)
      local entry_ctx = entry["ctx"]
      if type(entry_ctx) == "table" and ctx.spec ~= nil then
        local spec_map = entry_ctx["spec"]
        if type(spec_map) == "table" then
          spec_map["step"] = ctx.spec.step
        end
      end

      return result, nil
    end)
  end)

end)
