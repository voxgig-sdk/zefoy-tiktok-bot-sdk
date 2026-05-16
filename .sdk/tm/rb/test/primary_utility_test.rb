# ZefoyTiktokBot SDK primary utility test

require "minitest/autorun"
require "json"
require_relative "../ZefoyTiktokBot_sdk"
require_relative "runner"

class PrimaryUtilityTest < Minitest::Test

  def setup
    @spec = load_test_spec
    @primary = get_spec(@spec, "primary")
    assert @primary, "primary section not found in test.json"

    @client = ZefoyTiktokBotSDK.test(nil, nil)
    @utility = @client.get_utility
  end


  # === exists ===

  def test_exists
    assert @utility.clean, "clean should not be nil"
    assert @utility.done, "done should not be nil"
    assert @utility.make_error, "make_error should not be nil"
    assert @utility.feature_add, "feature_add should not be nil"
    assert @utility.feature_hook, "feature_hook should not be nil"
    assert @utility.feature_init, "feature_init should not be nil"
    assert @utility.fetcher, "fetcher should not be nil"
    assert @utility.make_fetch_def, "make_fetch_def should not be nil"
    assert @utility.make_context, "make_context should not be nil"
    assert @utility.make_options, "make_options should not be nil"
    assert @utility.make_request, "make_request should not be nil"
    assert @utility.make_response, "make_response should not be nil"
    assert @utility.make_result, "make_result should not be nil"
    assert @utility.make_point, "make_point should not be nil"
    assert @utility.make_spec, "make_spec should not be nil"
    assert @utility.make_url, "make_url should not be nil"
    assert @utility.param, "param should not be nil"
    assert @utility.prepare_auth, "prepare_auth should not be nil"
    assert @utility.prepare_body, "prepare_body should not be nil"
    assert @utility.prepare_headers, "prepare_headers should not be nil"
    assert @utility.prepare_method, "prepare_method should not be nil"
    assert @utility.prepare_params, "prepare_params should not be nil"
    assert @utility.prepare_path, "prepare_path should not be nil"
    assert @utility.prepare_query, "prepare_query should not be nil"
    assert @utility.result_basic, "result_basic should not be nil"
    assert @utility.result_body, "result_body should not be nil"
    assert @utility.result_headers, "result_headers should not be nil"
    assert @utility.transform_request, "transform_request should not be nil"
    assert @utility.transform_response, "transform_response should not be nil"
  end


  # === clean ===

  def test_clean_basic
    ctx = make_test_ctx(@client, @utility, nil)
    val = { "key" => "secret123", "name" => "test" }
    cleaned = @utility.clean.call(ctx, val)
    assert cleaned, "cleaned should not be nil"
  end


  # === done ===

  def test_done_basic
    runset(get_spec(@primary, "done", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      fixctx(ctx, @client)
      @utility.done.call(ctx)
    end
  end


  # === makeError ===

  def test_make_error_basic
    runset(get_spec(@primary, "makeError", "basic")) do |entry|
      args = entry["args"] || [{}]

      ctxmap = args[0].is_a?(Hash) ? args[0] : {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      fixctx(ctx, @client)

      err = nil
      if args.length > 1 && args[1].is_a?(Hash)
        err = err_from_map(args[1])
      end

      @utility.make_error.call(ctx, err)
    end
  end

  def test_make_error_no_throw
    ctx = make_test_full_ctx(@client, @utility)
    ctx.ctrl.throw_err = false
    ctx.result = ZefoyTiktokBotResult.new({
      "ok" => false,
      "resdata" => { "id" => "safe01" },
    })

    out, err = @utility.make_error.call(ctx, ctx.make_error("test_code", "test message"))
    assert_nil err, "expected no error"
    assert out.is_a?(Hash), "expected hash result, got: #{out.class}"
    assert_equal "safe01", out["id"], "expected id=safe01"
  end


  # === featureAdd ===

  def test_feature_add_basic
    ctx = make_test_ctx(@client, @utility, nil)
    start_len = @client.features.length

    feature = ZefoyTiktokBotBaseFeature.new
    @utility.feature_add.call(ctx, feature)

    assert_equal start_len + 1, @client.features.length,
      "expected #{start_len + 1} features, got #{@client.features.length}"
  end


  # === featureHook ===

  def test_feature_hook_basic
    hook_client = ZefoyTiktokBotSDK.test(nil, nil)
    hook_utility = hook_client.get_utility
    ctx = make_test_ctx(hook_client, hook_utility, nil)

    called = false
    hook_feature = TestHookFeature.new { called = true }
    hook_client.features = [hook_feature]

    hook_utility.feature_hook.call(ctx, "TestHook")
    assert called, "expected TestHook to be called"
  end


  # === featureInit ===

  def test_feature_init_basic
    init_client = ZefoyTiktokBotSDK.test(nil, nil)
    init_utility = init_client.get_utility
    ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      "initfeat" => { "active" => true },
    }

    init_called = false
    feature = TestInitFeature.new("initfeat", true) { init_called = true }

    init_utility.feature_init.call(ctx, feature)
    assert init_called, "expected init to be called"
  end

  def test_feature_init_inactive
    init_client = ZefoyTiktokBotSDK.test(nil, nil)
    init_utility = init_client.get_utility
    ctx = make_test_ctx(init_client, init_utility, nil)
    ctx.options["feature"] = {
      "nofeat" => { "active" => false },
    }

    init_called = false
    feature = TestInitFeature.new("nofeat", false) { init_called = true }

    init_utility.feature_init.call(ctx, feature)
    refute init_called, "expected init NOT to be called for inactive feature"
  end


  # === fetcher ===

  def test_fetcher_live
    calls = []
    live_client = ZefoyTiktokBotSDK.new({
      "system" => {
        "fetch" => ->(url, fetchdef) {
          calls << { "url" => url, "init" => fetchdef }
          return { "status" => 200, "statusText" => "OK" }, nil
        },
      },
    })
    live_utility = live_client.get_utility
    ctx = live_utility.make_context.call({
      "opname" => "load",
      "client" => live_client,
      "utility" => live_utility,
    }, nil)

    fetchdef = { "method" => "GET", "headers" => {} }
    _, err = live_utility.fetcher.call(ctx, "http://example.com/test", fetchdef)
    assert_nil err, "expected no error, got: #{err}"
    assert_equal 1, calls.length, "expected 1 call, got #{calls.length}"
    assert_equal "http://example.com/test", calls[0]["url"]
  end

  def test_fetcher_blocked_test_mode
    blocked_client = ZefoyTiktokBotSDK.new({
      "system" => {
        "fetch" => ->(url, fetchdef) {
          return {}, nil
        },
      },
    })
    blocked_client.mode = "test"

    blocked_utility = blocked_client.get_utility
    ctx = blocked_utility.make_context.call({
      "opname" => "load",
      "client" => blocked_client,
      "utility" => blocked_utility,
    }, nil)

    fetchdef = { "method" => "GET", "headers" => {} }
    _, err = blocked_utility.fetcher.call(ctx, "http://example.com/test", fetchdef)
    assert err, "expected error for test mode fetch"
    assert_match(/blocked/, err.to_s, "expected error containing 'blocked'")
  end


  # === makeContext ===

  def test_make_context_basic
    runset(get_spec(@primary, "makeContext", "basic")) do |entry|
      in_val = entry["in"]
      if in_val.is_a?(Hash)
        ctx = @utility.make_context.call(in_val, nil)
        out = { "id" => ctx.id }
        if ctx.op
          out["op"] = {
            "name" => ctx.op.name,
            "input" => ctx.op.input,
          }
        end
        out
      end
    end
  end


  # === makeFetchDef ===

  def test_make_fetch_def_basic
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = ZefoyTiktokBotSpec.new({
      "base" => "http://localhost:8080",
      "prefix" => "/api",
      "path" => "items/{id}",
      "suffix" => "",
      "params" => { "id" => "item01" },
      "query" => {},
      "headers" => { "content-type" => "application/json" },
      "method" => "GET",
      "step" => "start",
    })
    ctx.result = ZefoyTiktokBotResult.new({})

    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err, "should not be error: #{err}"
    assert_equal "GET", fetchdef["method"]
    url = fetchdef["url"] || ""
    assert_includes url, "/api/items/item01"
    assert_equal "application/json", fetchdef["headers"]["content-type"]
    assert_nil fetchdef["body"], "expected nil body"
  end

  def test_make_fetch_def_with_body
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = ZefoyTiktokBotSpec.new({
      "base" => "http://localhost:8080",
      "prefix" => "",
      "path" => "items",
      "suffix" => "",
      "params" => {},
      "query" => {},
      "headers" => {},
      "method" => "POST",
      "step" => "start",
      "body" => { "name" => "test" },
    })
    ctx.result = ZefoyTiktokBotResult.new({})

    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err, "should not be error: #{err}"
    assert_equal "POST", fetchdef["method"]
    body_str = fetchdef["body"]
    assert body_str.is_a?(String), "expected body string, got #{body_str.class}"
    assert_includes body_str, "\"name\""
  end


  # === makeOptions ===

  def test_make_options_basic
    runset(get_spec(@primary, "makeOptions", "basic")) do |entry|
      in_val = entry["in"] || {}
      ctx = @utility.make_context.call({
        "options" => in_val["options"],
        "config" => in_val["config"],
      }, nil)
      ctx.client = @client
      ctx.utility = @utility
      @utility.make_options.call(ctx)
    end
  end


  # === makeRequest ===

  def test_make_request_basic
    runset(get_spec(@primary, "makeRequest", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      ctx.options = @client.options_map

      _, err = @utility.make_request.call(ctx)
      raise err if err

      # Update entry ctx for match checking
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash)
        entry_ctx["response"] = "exists" if ctx.response
        entry_ctx["result"] = "exists" if ctx.result
      end

      nil
    end
  end


  # === makeResponse ===

  def test_make_response_basic
    runset(get_spec(@primary, "makeResponse", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      fixctx(ctx, @client)

      _, err = @utility.make_response.call(ctx)
      raise err if err

      # Update entry ctx for match checking with result data
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.result
        entry_ctx["result"] = {
          "ok" => ctx.result.ok,
          "status" => ctx.result.status,
          "statusText" => ctx.result.status_text,
          "headers" => ctx.result.headers,
          "body" => ctx.result.body,
        }
      end

      nil
    end
  end


  # === makeResult ===

  def test_make_result_basic
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = ZefoyTiktokBotSpec.new({
      "base" => "http://localhost:8080",
      "prefix" => "/api",
      "path" => "items/{id}",
      "suffix" => "",
      "params" => { "id" => "item01" },
      "query" => {},
      "headers" => {},
      "method" => "GET",
      "step" => "start",
    })
    ctx.result = ZefoyTiktokBotResult.new({
      "ok" => true,
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
      "resdata" => { "id" => "item01", "name" => "Test" },
    })

    result, err = @utility.make_result.call(ctx)
    assert_nil err, "expected no error, got: #{err}"
    assert_equal 200, result.status
  end

  def test_make_result_no_spec
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = nil
    ctx.result = ZefoyTiktokBotResult.new({
      "ok" => true,
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
    })

    _, err = @utility.make_result.call(ctx)
    assert err, "expected error for nil spec"
  end

  def test_make_result_no_result
    ctx = make_test_full_ctx(@client, @utility)
    ctx.spec = ZefoyTiktokBotSpec.new({ "step" => "start" })
    ctx.result = nil

    _, err = @utility.make_result.call(ctx)
    assert err, "expected error for nil result"
  end


  # === makeSpec ===

  def test_make_spec_basic
    setup_opts = get_spec(@primary, "makeSpec", "DEF", "setup", "a")
    spec_client = ZefoyTiktokBotSDK.test(nil, setup_opts)
    spec_utility = spec_client.get_utility

    runset(get_spec(@primary, "makeSpec", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, spec_client, spec_utility)
      ctx.options = spec_client.options_map

      _, err = @utility.make_spec.call(ctx)
      raise err if err

      # Update entry ctx for match
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.spec
        entry_ctx["spec"] = {
          "base" => ctx.spec.base,
          "prefix" => ctx.spec.prefix,
          "suffix" => ctx.spec.suffix,
          "method" => ctx.spec.method,
          "params" => ctx.spec.params,
          "query" => ctx.spec.query,
          "headers" => ctx.spec.headers,
          "step" => ctx.spec.step,
        }
      end

      nil
    end
  end


  # === makePoint ===

  def test_make_point_basic
    ctx = make_test_ctx(@client, @utility, nil)
    point = {
      "parts" => ["items", "{id}"],
      "args" => { "params" => [] },
      "params" => [],
      "alias" => {},
      "select" => {},
      "active" => true,
      "transform" => {},
    }
    ctx.op.points = [point]

    _, err = @utility.make_point.call(ctx)
    assert_nil err, "expected no error, got: #{err}"
    assert ctx.point, "expected point to be set"
  end


  # === makeUrl ===

  def test_make_url_basic
    runset(get_spec(@primary, "makeUrl", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      ctx.result = ZefoyTiktokBotResult.new({}) unless ctx.result
      @utility.make_url.call(ctx)
    end
  end


  # === operator ===

  def test_operator_basic
    runset(get_spec(@primary, "operator", "basic")) do |entry|
      in_val = entry["in"] || {}
      op = ZefoyTiktokBotOperation.new(in_val)
      {
        "entity" => op.entity,
        "name" => op.name,
        "input" => op.input,
        "points" => op.points,
      }
    end
  end


  # === param ===

  def test_param_basic
    runset(get_spec(@primary, "param", "basic")) do |entry|
      args = entry["args"] || []
      next nil if args.length < 2

      ctxmap = args[0].is_a?(Hash) ? args[0] : {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      paramdef = args[1]

      result = @utility.param.call(ctx, paramdef)

      # Update entry ctx for match
      if entry["match"].is_a?(Hash)
        ctx_match = entry["match"]["ctx"]
        if ctx_match.is_a?(Hash)
          entry_ctx = entry["ctx"]
          if entry_ctx.nil?
            entry_ctx = {}
            entry["ctx"] = entry_ctx
          end
          spec_match = ctx_match["spec"]
          if spec_match.is_a?(Hash) && ctx.spec
            entry_ctx["spec"] = {} unless entry_ctx["spec"]
            if spec_match["alias"]
              entry_ctx["spec"] = {
                "alias" => ctx.spec.alias_map,
              }
            end
          end
        end
      end

      result
    end
  end


  # === prepareAuth ===

  def test_prepare_auth_basic
    setup_opts = get_spec(@primary, "prepareAuth", "DEF", "setup", "a")
    auth_client = ZefoyTiktokBotSDK.test(nil, setup_opts)
    auth_utility = auth_client.get_utility

    runset(get_spec(@primary, "prepareAuth", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, auth_client, auth_utility)
      fixctx(ctx, auth_client)

      _, err = @utility.prepare_auth.call(ctx)
      raise err if err

      # Update entry ctx for match
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.spec
        entry_ctx["spec"] = {
          "headers" => ctx.spec.headers,
        }
      end

      nil
    end
  end


  # === prepareBody ===

  def test_prepare_body_basic
    runset(get_spec(@primary, "prepareBody", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      fixctx(ctx, @client)
      @utility.prepare_body.call(ctx)
    end
  end


  # === prepareHeaders ===

  def test_prepare_headers_basic
    runset(get_spec(@primary, "prepareHeaders", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      @utility.prepare_headers.call(ctx)
    end
  end


  # === prepareMethod ===

  def test_prepare_method_basic
    runset(get_spec(@primary, "prepareMethod", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      @utility.prepare_method.call(ctx)
    end
  end


  # === prepareParams ===

  def test_prepare_params_basic
    runset(get_spec(@primary, "prepareParams", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      @utility.prepare_params.call(ctx)
    end
  end


  # === preparePath ===

  def test_prepare_path_basic
    ctx = make_test_full_ctx(@client, @utility)
    ctx.point = {
      "parts" => ["api", "planet", "{id}"],
      "args" => { "params" => [] },
    }

    path = @utility.prepare_path.call(ctx)
    assert_equal "api/planet/{id}", path
  end

  def test_prepare_path_single
    ctx = make_test_full_ctx(@client, @utility)
    ctx.point = {
      "parts" => ["items"],
      "args" => { "params" => [] },
    }

    path = @utility.prepare_path.call(ctx)
    assert_equal "items", path
  end


  # === prepareQuery ===

  def test_prepare_query_basic
    runset(get_spec(@primary, "prepareQuery", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      @utility.prepare_query.call(ctx)
    end
  end


  # === resultBasic ===

  def test_result_basic_basic
    runset(get_spec(@primary, "resultBasic", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)
      fixctx(ctx, @client)

      result = @utility.result_basic.call(ctx)

      out = {
        "status" => result.status,
        "statusText" => result.status_text,
      }
      if result.err
        out["err"] = {
          "message" => result.err.to_s,
        }
      end

      out
    end
  end


  # === resultBody ===

  def test_result_body_basic
    runset(get_spec(@primary, "resultBody", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)

      @utility.result_body.call(ctx)

      # Update entry ctx for match
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.result
        entry_ctx["result"] = {
          "body" => ctx.result.body,
        }
      end

      nil
    end
  end


  # === resultHeaders ===

  def test_result_headers_basic
    runset(get_spec(@primary, "resultHeaders", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)

      @utility.result_headers.call(ctx)

      # Update entry ctx for match
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.result
        entry_ctx["result"] = {
          "headers" => ctx.result.headers,
        }
      end

      nil
    end
  end


  # === transformRequest ===

  def test_transform_request_basic
    runset(get_spec(@primary, "transformRequest", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)

      result = @utility.transform_request.call(ctx)

      # Update entry ctx for match (step changed)
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.spec
        spec_map = entry_ctx["spec"]
        spec_map["step"] = ctx.spec.step if spec_map.is_a?(Hash)
      end

      result
    end
  end


  # === transformResponse ===

  def test_transform_response_basic
    runset(get_spec(@primary, "transformResponse", "basic")) do |entry|
      ctxmap = entry["ctx"] || {}
      ctx = make_ctx_from_map(ctxmap, @client, @utility)

      result = @utility.transform_response.call(ctx)

      # Update entry ctx for match (step changed)
      entry_ctx = entry["ctx"]
      if entry_ctx.is_a?(Hash) && ctx.spec
        spec_map = entry_ctx["spec"]
        spec_map["step"] = ctx.spec.step if spec_map.is_a?(Hash)
      end

      result
    end
  end


  private

  # === Helper: load test spec ===
  def load_test_spec
    path = File.join(__dir__, '../../.sdk/test/test.json')
    data = File.read(path)
    JSON.parse(data)
  end

  # === Helper: get nested spec ===
  def get_spec(spec, *keys)
    cur = spec
    keys.each do |key|
      return nil unless cur.is_a?(Hash)
      cur = cur[key]
    end
    cur.is_a?(Hash) ? cur : nil
  end

  # === Helper: runset ===
  def runset(testspec, &subject)
    return unless testspec
    set = testspec["set"]
    return unless set.is_a?(Array)

    set.each_with_index do |entry, i|
      next unless entry.is_a?(Hash)

      mark = entry["mark"] ? " (mark=#{entry["mark"]})" : ""

      begin
        result, err = subject.call(entry)

        expected_err = entry["err"]

        if err
          if expected_err
            err_msg = err.to_s
            if expected_err.is_a?(String)
              unless match_string(expected_err, err_msg)
                flunk "entry #{i}#{mark}: error mismatch: got #{err_msg.inspect}, want contains #{expected_err.inspect}"
              end
            elsif expected_err == true
              # err: true means any error is acceptable
            end
            if entry["match"].is_a?(Hash)
              result_map = {
                "in" => entry["in"],
                "out" => json_normalize(result),
                "err" => { "message" => err.to_s },
              }
              match_deep(i, mark, entry["match"], result_map, "")
            end
            next
          end
          flunk "entry #{i}#{mark}: unexpected error: #{err}"
          next
        end

        if expected_err
          flunk "entry #{i}#{mark}: expected error containing #{expected_err.inspect} but got result: #{json_str(result)}"
          next
        end

        matched = false
        if entry["match"].is_a?(Hash)
          result_map = {
            "in" => entry["in"],
            "out" => json_normalize(result),
          }
          if entry["args"]
            result_map["args"] = entry["args"]
          elsif entry["in"]
            result_map["args"] = [entry["in"]]
          end
          result_map["ctx"] = entry["ctx"] if entry["ctx"]
          match_deep(i, mark, entry["match"], result_map, "")
          matched = true
        end

        expected_out = entry["out"]
        next if expected_out.nil? && matched

        if expected_out
          norm_result = json_normalize(result)
          norm_expected = json_normalize(expected_out)
          unless deep_equal(norm_result, norm_expected)
            flunk "entry #{i}#{mark}: output mismatch:\n  got:  #{json_str(norm_result)}\n  want: #{json_str(norm_expected)}"
          end
        end

      rescue => e
        expected_err = entry["err"]
        if expected_err
          err_msg = e.to_s
          if expected_err.is_a?(String)
            unless match_string(expected_err, err_msg)
              flunk "entry #{i}#{mark}: error mismatch: got #{err_msg.inspect}, want contains #{expected_err.inspect}"
            end
          elsif expected_err == true
            # err: true means any error is acceptable
          end
          if entry["match"].is_a?(Hash)
            result_map = {
              "in" => entry["in"],
              "out" => json_normalize(nil),
              "err" => { "message" => e.to_s },
            }
            match_deep(i, mark, entry["match"], result_map, "")
          end
          next
        end
        raise
      end
    end
  end

  # === Helper: json_normalize ===
  def json_normalize(val)
    return nil if val.nil?
    j = JSON.generate(val)
    JSON.parse(j)
  rescue
    val
  end

  # === Helper: json_str ===
  def json_str(val)
    JSON.generate(val)
  rescue
    val.to_s
  end

  # === Helper: match_deep ===
  def match_deep(entry_idx, mark, check, base, path)
    return if check.nil?

    if check.is_a?(Hash)
      check.each do |key, check_val|
        child_path = "#{path}.#{key}"
        base_val = base.is_a?(Hash) ? base[key] : nil
        match_deep(entry_idx, mark, check_val, base_val, child_path)
      end
    elsif check.is_a?(Array)
      check.each_with_index do |check_val, ci|
        child_path = "#{path}[#{ci}]"
        base_val = (base.is_a?(Array) && ci < base.length) ? base[ci] : nil
        match_deep(entry_idx, mark, check_val, base_val, child_path)
      end
    else
      if check.is_a?(String) && check == "__EXISTS__"
        if base.nil?
          flunk "entry #{entry_idx}#{mark}: match #{path}: expected value to exist but got nil"
        end
        return
      end
      if check.is_a?(String) && check == "__UNDEF__"
        if base != nil
          flunk "entry #{entry_idx}#{mark}: match #{path}: expected nil but got #{base.inspect}"
        end
        return
      end

      norm_check = json_normalize(check)
      norm_base = json_normalize(base)

      unless deep_equal(norm_check, norm_base)
        if check.is_a?(String) && !check.empty?
          base_str = base.nil? ? "" : base.to_s
          return if match_string(check, base_str)
        end
        flunk "entry #{entry_idx}#{mark}: match #{path}: got #{json_str(norm_base)}, want #{json_str(norm_check)}"
      end
    end
  end

  # === Helper: match_string ===
  def match_string(pattern, val)
    if pattern.length >= 2 && pattern[0] == '/' && pattern[-1] == '/'
      re = Regexp.new(pattern[1..-2])
      return re.match?(val)
    end
    val.downcase.include?(pattern.downcase)
  end

  # === Helper: deep_equal ===
  def deep_equal(a, b)
    normalize = lambda { |v|
      case v
      when Hash
        sorted = {}
        v.keys.sort.each { |k| sorted[k] = normalize.call(v[k]) }
        sorted
      when Array
        v.map { |e| normalize.call(e) }
      else
        v
      end
    }
    JSON.generate(normalize.call(a)) == JSON.generate(normalize.call(b))
  rescue
    a == b
  end

  # === Helper: make_test_ctx ===
  def make_test_ctx(client, utility, overrides)
    ctxmap = {
      "opname" => "load",
      "client" => client,
      "utility" => utility,
    }
    if overrides
      overrides.each { |k, v| ctxmap[k] = v }
    end
    utility.make_context.call(ctxmap, client.get_root_ctx)
  end

  # === Helper: make_test_full_ctx ===
  def make_test_full_ctx(client, utility)
    ctx = make_test_ctx(client, utility, nil)
    ctx.point = {
      "parts" => ["items", "{id}"],
      "args" => { "params" => [{ "name" => "id", "reqd" => true }] },
      "params" => ["id"],
      "alias" => {},
      "select" => {},
      "active" => true,
      "transform" => {},
    }
    ctx.match = { "id" => "item01" }
    ctx.reqmatch = { "id" => "item01" }
    ctx
  end

  # === Helper: make_ctx_from_map ===
  def make_ctx_from_map(ctxmap, client, utility)
    ctxmap = {} unless ctxmap.is_a?(Hash)

    ctx = ZefoyTiktokBotContext.new(ctxmap, nil)

    if client
      ctx.client = client
      ctx.utility = utility
    end
    if ctx.options.nil? && client
      ctx.options = client.options_map
    end

    # Handle spec from JSON map
    if ctxmap["spec"].is_a?(Hash)
      ctx.spec = ZefoyTiktokBotSpec.new(ctxmap["spec"])
    end

    # Handle result from JSON map
    if ctxmap["result"].is_a?(Hash)
      res_map = ctxmap["result"]
      ctx.result = ZefoyTiktokBotResult.new(res_map)
      if res_map["err"].is_a?(Hash) && res_map["err"]["message"].is_a?(String)
        ctx.result.err = ZefoyTiktokBotError.new("", res_map["err"]["message"])
      end
    end

    # Handle response from JSON map
    if ctxmap["response"].is_a?(Hash)
      resp_map = ctxmap["response"]
      ctx.response = ZefoyTiktokBotResponse.new(resp_map)
      if resp_map["body"]
        body_copy = resp_map["body"]
        ctx.response.json_func = -> { body_copy }
      end
      if resp_map["headers"].is_a?(Hash)
        lower_headers = {}
        resp_map["headers"].each { |k, v| lower_headers[k.downcase] = v }
        ctx.response.headers = lower_headers
      end
    end

    ctx
  end

  # === Helper: fixctx ===
  def fixctx(ctx, client)
    if ctx && ctx.client && ctx.options.nil?
      ctx.options = ctx.client.options_map
    end
  end

  # === Helper: err_from_map ===
  def err_from_map(m)
    return nil unless m.is_a?(Hash)
    msg = m["message"]
    return nil unless msg.is_a?(String) && !msg.empty?
    code = m["code"] || ""
    ZefoyTiktokBotError.new(code, msg)
  end
end


# === Test hook feature for featureHook test ===
class TestHookFeature < ZefoyTiktokBotBaseFeature
  def initialize(&hook_fn)
    super()
    @hook_fn = hook_fn
  end

  def TestHook(ctx)
    @hook_fn.call if @hook_fn
  end
end


# === Test init feature for featureInit test ===
class TestInitFeature < ZefoyTiktokBotBaseFeature
  def initialize(name, active, &init_fn)
    super()
    @name = name
    @active = active
    @init_fn = init_fn
  end

  def get_name; @name; end
  def get_active; @active; end

  def init(ctx, options)
    @init_fn.call if @init_fn
  end
end
