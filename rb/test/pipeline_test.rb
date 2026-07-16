# ZefoyTiktokBot SDK pipeline test
#
# Direct unit tests for the operation-pipeline utilities. The generated
# entity tests exercise the happy path; these drive the error and edge
# branches (missing spec/response/result, 4xx handling, transport
# failures, feature ordering, auth header shaping) that a normal
# success-path op never reaches. All utilities are reached through the
# client's utility view, so this suite is API-agnostic.

require "minitest/autorun"
require "json"
require_relative "../ZefoyTiktokBot_sdk"

class PipelineTest < Minitest::Test
  def setup
    @client = ZefoyTiktokBotSDK.test(nil, nil)
    @utility = @client.get_utility
  end

  # Fake client so the exact options shape is controlled (prepare_auth).
  class OptClient
    def initialize(options)
      @options = options
    end

    def options_map
      out = VoxgigStruct.clone(@options)
      out.is_a?(Hash) ? out : {}
    end
  end

  def make_ctx(opname: "load", client: nil, utility: nil)
    utility ||= @utility
    ctx = utility.make_context.call({
      "opname" => opname,
      "client" => client || @client,
      "utility" => utility,
    }, nil)
    ctx.options = ctx.client.options_map if ctx.options.nil? && ctx.client.respond_to?(:options_map)
    ctx
  end

  # Transport-shaped response with a re-readable body + lowercase headers.
  def resp(status, data = nil, headers = nil)
    h = {}
    (headers || {}).each { |k, v| h[k.to_s.downcase] = v }
    ZefoyTiktokBotResponse.new({
      "status" => status,
      "statusText" => status < 400 ? "OK" : "ERR",
      "body" => "body",
      "json" => -> { data },
      "headers" => h,
    })
  end

  def spec_of(map = {})
    ZefoyTiktokBotSpec.new({ "step" => "s", "method" => "GET", "headers" => {} }.merge(map))
  end

  # A utility view whose fetcher (or other member) is overridden.
  def util_with(fetcher)
    u = @client.get_utility
    u.fetcher = fetcher
    u
  end


  # === feature order (feature #2) ===
  # options["feature"] accepts an ordered ARRAY (developer add-order) or a map
  # (defaults test-first); make_options records the resolved order in
  # __derived__.featureorder.

  def resolve_order(feature)
    ctx = @utility.make_context.call({
      "client" => @client,
      "utility" => @utility,
    }, nil)
    ctx.options = { "feature" => feature }
    ctx.config = { "options" => {} }
    opts = @utility.make_options.call(ctx)
    (opts["__derived__"]["featureorder"] || []).join(",")
  end

  def test_feature_order_map_is_test_first
    assert_equal "test,metrics", resolve_order({
      "metrics" => { "active" => true },
      "test" => { "active" => true },
    })
  end

  def test_feature_order_array_preserves_order
    assert_equal "metrics,test", resolve_order([
      { "name" => "metrics", "active" => true },
      { "name" => "test", "active" => true },
    ])
  end

  def test_feature_order_no_test_deterministic
    assert_equal "cache,retry", resolve_order({
      "retry" => { "active" => true },
      "cache" => { "active" => true },
    })
  end


  # === make_point ===

  def test_make_point_rejects_a_disallowed_operation
    ctx = make_ctx(opname: "nope")
    _, err = @utility.make_point.call(ctx)
    assert_equal "point_op_allow", err.code
  end

  def test_make_point_rejects_an_operation_with_no_endpoints
    ctx = make_ctx
    ctx.op.points = []
    _, err = @utility.make_point.call(ctx)
    assert_equal "point_no_points", err.code
  end

  def test_make_point_returns_the_single_point
    ctx = make_ctx
    point = { "parts" => ["a"], "args" => { "params" => [] } }
    ctx.op.points = [point]
    out, err = @utility.make_point.call(ctx)
    assert_nil err
    assert_equal point, out
  end

  def test_make_point_short_circuits_a_feature_supplied_point
    ctx = make_ctx
    preset = { "parts" => ["a"] }
    ctx.out["point"] = preset
    out, err = @utility.make_point.call(ctx)
    assert_nil err
    assert_equal preset, out
  end

  def test_make_point_surfaces_a_feature_supplied_error
    # The PrePoint short-circuit analog: a feature (e.g. rbac) places an
    # error in ctx.out["point"]; make_point must fail before any network.
    ctx = make_ctx
    denial = ctx.make_error("rbac_denied", "denied")
    ctx.out["point"] = denial
    out, err = @utility.make_point.call(ctx)
    assert_nil out
    assert_equal "rbac_denied", err.code
  end


  # === make_spec ===

  def test_make_spec_short_circuits_a_feature_supplied_spec
    ctx = make_ctx
    preset = spec_of("method" => "GET")
    ctx.out["spec"] = preset
    out, err = @utility.make_spec.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_response ===

  def test_make_response_guards_missing_spec_response_result
    ctx = make_ctx
    ctx.spec = nil
    ctx.response = resp(200)
    ctx.result = ZefoyTiktokBotResult.new({})
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_spec", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = nil
    ctx.result = ZefoyTiktokBotResult.new({})
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_response", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(200)
    ctx.result = nil
    _, err = @utility.make_response.call(ctx)
    assert_equal "response_no_result", err.code
  end

  def test_make_response_4xx_sets_result_err_and_copies_headers
    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(404, nil, { "x-a" => "1" })
    ctx.result = ZefoyTiktokBotResult.new({})
    _, err = @utility.make_response.call(ctx)
    assert_nil err
    refute_nil ctx.result.err
    assert_equal 404, ctx.result.status
    assert_equal "1", ctx.result.headers["x-a"]
    assert_equal false, ctx.result.ok
  end

  def test_make_response_2xx_parses_the_body_and_marks_ok
    ctx = make_ctx
    ctx.spec = spec_of
    ctx.response = resp(200, { "v" => 1 })
    ctx.result = ZefoyTiktokBotResult.new({})
    _, err = @utility.make_response.call(ctx)
    assert_nil err
    assert_equal true, ctx.result.ok
    assert_equal({ "v" => 1 }, ctx.result.body)
  end

  def test_make_response_records_to_ctrl_explain
    ctx = make_ctx
    ctx.ctrl.explain = {}
    ctx.spec = spec_of
    ctx.response = resp(200, { "v" => 2 })
    ctx.result = ZefoyTiktokBotResult.new({})
    @utility.make_response.call(ctx)
    refute_nil ctx.ctrl.explain["result"]
  end

  def test_make_response_short_circuits_a_feature_supplied_response
    ctx = make_ctx
    preset = resp(299)
    ctx.out["response"] = preset
    ctx.spec = spec_of
    ctx.response = resp(200)
    ctx.result = ZefoyTiktokBotResult.new({})
    out, err = @utility.make_response.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_result ===

  def test_make_result_guards_missing_spec_and_result
    ctx = make_ctx
    ctx.spec = nil
    ctx.result = ZefoyTiktokBotResult.new({})
    _, err = @utility.make_result.call(ctx)
    assert_equal "result_no_spec", err.code

    ctx = make_ctx
    ctx.spec = spec_of
    ctx.result = nil
    _, err = @utility.make_result.call(ctx)
    assert_equal "result_no_result", err.code
  end

  def make_fake_entity(made)
    fake = Object.new
    fake.define_singleton_method(:make) do
      rec = Object.new
      rec.define_singleton_method(:data_set) { |d| made << d }
      rec
    end
    fake
  end

  def test_make_result_list_op_wraps_resdata_into_entities
    made = []
    ctx = @utility.make_context.call({
      "opname" => "list",
      "client" => @client,
      "utility" => @utility,
      "entity" => make_fake_entity(made),
    }, nil)
    ctx.spec = spec_of
    ctx.result = ZefoyTiktokBotResult.new({
      "ok" => true, "resdata" => [{ "a" => 1 }, { "a" => 2 }],
    })
    result, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal 2, result.resdata.length
    assert_equal 2, made.length
    assert_equal [{ "a" => 1 }, { "a" => 2 }], made
  end

  def test_make_result_empty_list_yields_an_empty_resdata_array
    made = []
    ctx = @utility.make_context.call({
      "opname" => "list",
      "client" => @client,
      "utility" => @utility,
      "entity" => make_fake_entity(made),
    }, nil)
    ctx.spec = spec_of
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => true, "resdata" => [] })
    result, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal [], result.resdata
  end

  def test_make_result_short_circuits_a_preset_result
    ctx = make_ctx
    preset = ZefoyTiktokBotResult.new({ "ok" => true })
    ctx.out["result"] = preset
    out, err = @utility.make_result.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_request ===

  def test_make_request_guards_a_missing_spec
    ctx = make_ctx
    ctx.spec = nil
    _, err = @utility.make_request.call(ctx)
    assert_equal "request_no_spec", err.code
  end

  def request_spec
    spec_of("base" => "http://h", "path" => "a")
  end

  def test_make_request_a_transport_error_tuple_lands_on_the_response
    boom = ZefoyTiktokBotError.new("boom", "boom")
    u = util_with(->(_c, _u, _f) { [nil, boom] })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    assert_equal boom, response.err
  end

  def test_make_request_a_nil_transport_result_becomes_a_response_error
    u = util_with(->(_c, _u, _f) { [nil, nil] })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    refute_nil response.err
  end

  def test_make_request_wraps_a_normal_transport_response
    u = util_with(->(_c, _u, _f) {
      [{ "status" => 200, "statusText" => "OK", "headers" => {},
         "json" => -> { { "a" => 1 } }, "body" => "b" }, nil]
    })
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    assert_equal 200, response.status
  end

  def test_make_request_records_the_fetchdef_to_ctrl_explain
    u = util_with(->(_c, _u, _f) {
      [{ "status" => 200, "statusText" => "OK", "headers" => {},
         "json" => -> { nil }, "body" => "b" }, nil]
    })
    ctx = make_ctx(utility: u)
    ctx.ctrl.explain = {}
    ctx.spec = request_spec
    u.make_request.call(ctx)
    refute_nil ctx.ctrl.explain["fetchdef"]
  end

  def test_make_request_a_fetchdef_error_surfaces_as_a_response_error
    u = @client.get_utility
    u.make_fetch_def = ->(ctx) { [nil, ZefoyTiktokBotError.new("fetchdef_boom", "boom")] }
    ctx = make_ctx(utility: u)
    ctx.spec = request_spec
    response, err = u.make_request.call(ctx)
    assert_nil err
    refute_nil response.err
    assert_equal "fetchdef_boom", response.err.code
  end

  def test_make_request_short_circuits_a_feature_supplied_request
    ctx = make_ctx
    preset = resp(201)
    ctx.out["request"] = preset
    ctx.spec = request_spec
    out, err = @utility.make_request.call(ctx)
    assert_nil err
    assert_equal preset, out
  end


  # === make_fetch_def ===

  def test_make_fetch_def_guards_a_missing_spec
    ctx = make_ctx
    ctx.spec = nil
    _, err = @utility.make_fetch_def.call(ctx)
    assert_equal "fetchdef_no_spec", err.code
  end

  def test_make_fetch_def_serialises_a_hash_body_and_inits_a_missing_result
    ctx = make_ctx
    ctx.result = nil
    ctx.spec = spec_of(
      "method" => "POST", "base" => "http://h", "path" => "a",
      "body" => { "x" => 1 })
    fetchdef, err = @utility.make_fetch_def.call(ctx)
    assert_nil err
    assert_kind_of String, fetchdef["body"]
    assert_includes fetchdef["url"], "http://h"
    refute_nil ctx.result # result was lazily created
  end


  # === make_error + done ===

  def test_done_returns_resdata_on_success
    ctx = make_ctx
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => true, "resdata" => 42 })
    assert_equal 42, @utility.done.call(ctx)
  end

  def test_done_raises_the_error_when_not_ok
    ctx = make_ctx
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => false })
    assert_raises(ZefoyTiktokBotError) { @utility.done.call(ctx) }
  end

  def test_done_cleans_ctrl_explain_on_success
    ctx = make_ctx
    ctx.ctrl.explain = { "result" => { "err" => "x" } }
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => true, "resdata" => 7 })
    assert_equal 7, @utility.done.call(ctx)
  end

  def test_make_error_returns_resdata_when_throw_is_disabled
    ctx = make_ctx
    ctx.ctrl.throw_err = false
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => false, "resdata" => "fallback" })
    assert_equal "fallback", @utility.make_error.call(ctx, nil)
  end

  def test_make_error_records_to_ctrl_explain
    ctx = make_ctx
    ctx.ctrl.throw_err = false
    ctx.ctrl.explain = {}
    ctx.result = ZefoyTiktokBotResult.new({ "ok" => false })
    @utility.make_error.call(ctx, nil)
    refute_nil ctx.ctrl.explain["err"]
  end

  def test_make_error_preserves_the_error_code
    ctx = make_ctx
    err = assert_raises(ZefoyTiktokBotError) {
      @utility.make_error.call(ctx, ctx.make_error("rbac_denied", "denied"))
    }
    assert_equal "rbac_denied", err.code
  end


  # === feature ordering ===

  def test_feature_add_appends_in_call_order
    client = ZefoyTiktokBotSDK.test(nil, nil)
    utility = client.get_utility
    ctx = utility.make_context.call({
      "opname" => "load", "client" => client, "utility" => utility,
    }, nil)

    client.features = []
    a = ZefoyTiktokBotBaseFeature.new
    b = ZefoyTiktokBotBaseFeature.new
    utility.feature_add.call(ctx, a)
    utility.feature_add.call(ctx, b)
    assert_equal [a, b], client.features
  end

  def named_feature(name)
    f = ZefoyTiktokBotBaseFeature.new
    f.name = name
    f
  end

  # `_options` on an extend-feature instance positions it relative to an
  # already-added feature (mirrors the ts featureAdd).
  def test_feature_add_ordering_before_after_replace
    client = ZefoyTiktokBotSDK.test(nil, nil)
    utility = client.get_utility
    ctx = utility.make_context.call({
      "opname" => "load", "client" => client, "utility" => utility,
    }, nil)

    client.features = []
    names = -> { client.features.map(&:name) }

    utility.feature_add.call(ctx, named_feature("a"))
    utility.feature_add.call(ctx, named_feature("b"))
    assert_equal %w[a b], names.call

    before = named_feature("z1")
    before._options = { "__before__" => "b" }
    utility.feature_add.call(ctx, before)
    assert_equal %w[a z1 b], names.call

    after = named_feature("z2")
    after._options = { "__after__" => "a" }
    utility.feature_add.call(ctx, after)
    assert_equal %w[a z2 z1 b], names.call

    replace = named_feature("z3")
    replace._options = { "__replace__" => "z1" }
    utility.feature_add.call(ctx, replace)
    assert_equal %w[a z2 z3 b], names.call

    # An ordering option naming no existing feature falls back to append.
    miss = named_feature("z4")
    miss._options = { "__before__" => "missing" }
    utility.feature_add.call(ctx, miss)
    assert_equal %w[a z2 z3 b z4], names.call
  end


  # === prepare_auth ===

  def auth_ctx(options, headers)
    ctx = ZefoyTiktokBotContext.new({
      "client" => OptClient.new(options),
      "utility" => @utility,
      "opname" => "load",
    }, nil)
    ctx.spec = headers.nil? ? nil : ZefoyTiktokBotSpec.new({ "headers" => headers, "step" => "s" })
    ctx
  end

  def test_prepare_auth_guards_a_missing_spec
    ctx = auth_ctx({ "auth" => { "prefix" => "" }, "apikey" => "K" }, nil)
    _, err = @utility.prepare_auth.call(ctx)
    assert_equal "auth_no_spec", err.code
  end

  def test_prepare_auth_an_apikey_with_a_prefix_is_space_joined
    ctx = auth_ctx({ "apikey" => "K", "auth" => { "prefix" => "Bearer" } }, {})
    _, err = @utility.prepare_auth.call(ctx)
    assert_nil err
    assert_equal "Bearer K", ctx.spec.headers["authorization"]
  end

  def test_prepare_auth_a_raw_apikey_goes_in_as_is
    ctx = auth_ctx({ "apikey" => "K", "auth" => { "prefix" => "" } }, {})
    @utility.prepare_auth.call(ctx)
    assert_equal "K", ctx.spec.headers["authorization"]
  end

  def test_prepare_auth_an_empty_apikey_drops_the_header
    ctx = auth_ctx({ "apikey" => "", "auth" => { "prefix" => "Bearer" } },
      { "authorization" => "stale" })
    @utility.prepare_auth.call(ctx)
    assert_nil ctx.spec.headers["authorization"]
  end

  def test_prepare_auth_a_public_api_drops_the_header
    ctx = auth_ctx({ "apikey" => "K" }, { "authorization" => "stale" })
    @utility.prepare_auth.call(ctx)
    assert_nil ctx.spec.headers["authorization"]
  end

  def test_prepare_auth_a_missing_apikey_option_drops_the_header
    ctx = auth_ctx({ "auth" => { "prefix" => "Bearer" } }, { "authorization" => "stale" })
    @utility.prepare_auth.call(ctx)
    assert_nil ctx.spec.headers["authorization"]
  end


  # === result helpers ===

  def test_result_headers_with_non_hash_headers_yields_an_empty_map
    ctx = make_ctx
    ctx.response = ZefoyTiktokBotResponse.new({ "status" => 200 })
    ctx.result = ZefoyTiktokBotResult.new({})
    @utility.result_headers.call(ctx)
    assert_equal({}, ctx.result.headers)
  end

  def test_result_body_skips_parsing_when_the_body_is_absent
    ctx = make_ctx
    ctx.response = ZefoyTiktokBotResponse.new({
      "status" => 200, "json" => -> { { "a" => 1 } }, "body" => nil,
    })
    ctx.result = ZefoyTiktokBotResult.new({})
    @utility.result_body.call(ctx)
    assert_nil ctx.result.body
  end
end
