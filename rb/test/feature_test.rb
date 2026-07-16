# ZefoyTiktokBot SDK feature test
#
# Behavioural tests for the enterprise features shipped with this SDK.
# Each block runs only when its feature is present (see has_feature?),
# driving the real generated feature class through an offline miniature of
# the operation pipeline - the same hook order and short-circuit rules as
# the generated entity operations - against a configurable mock transport.
# All timing goes through an injectable virtual clock, so the suite is
# fully deterministic.

require "minitest/autorun"
require "json"
require_relative "../ZefoyTiktokBot_sdk"

module ZefoyTiktokBotFeatureHarness
  # True when this SDK was generated with the named feature.
  def self.has_feature?(name)
    f = ZefoyTiktokBotConfig.make_config["feature"]
    f.is_a?(Hash) && !f[name].nil?
  end

  def self.default_method(opname)
    return "POST" if opname == "create"
    return "PATCH" if opname == "update"
    return "DELETE" if opname == "remove"
    "GET"
  end

  # Build a transport-shaped response hash the pipeline understands.
  def self.make_response(status, data = nil, headers = nil)
    h = {}
    (headers || {}).each { |k, v| h[k.to_s.downcase] = v }
    {
      "status" => status,
      "statusText" => status < 400 ? "OK" : "ERR",
      "body" => "not-used",
      "json" => -> { data },
      "headers" => h,
    }
  end

  def self.default_server
    ->(_fctx, _fullurl, fetchdef) {
      method = (fetchdef["method"] || "GET").to_s.upcase
      if method == "GET"
        [make_response(200, { "ok" => true, "method" => method }), nil]
      else
        [make_response(200, { "ok" => true, "method" => method, "echo" => fetchdef["body"] }), nil]
      end
    }
  end

  # A recording transport: returns [server_lambda, calls_array]. The
  # optional reply block maps (n, fetchdef) -> [response, err] tuple.
  def self.recording_server(&reply)
    calls = []
    server = ->(_fctx, fullurl, fetchdef) {
      calls << { "url" => fullurl, "fetchdef" => fetchdef }
      if reply
        reply.call(calls.length, fetchdef)
      else
        [make_response(200, { "ok" => true, "n" => calls.length }), nil]
      end
    }
    [server, calls]
  end

  # A deterministic virtual clock: now() advances only when sleep(ms) is
  # called, so timing-based features can be asserted without real delays.
  class Clock
    attr_reader :time

    def initialize(start = 0)
      @time = start
    end

    def now
      clock = self
      -> { clock.time }
    end

    def sleeper
      clock = self
      ->(ms) { clock.advance(ms || 0) }
    end

    def advance(ms)
      @time += ms
    end
  end

  class FakeClient
    attr_accessor :features, :mode, :options

    def initialize(options)
      @features = []
      @mode = "test"
      @options = options
    end

    def options_map
      out = VoxgigStruct.clone(@options)
      out.is_a?(Hash) ? out : {}
    end
  end

  class FakeEntity
    def initialize(name)
      @name = name
    end

    def get_name
      @name
    end
  end

  # A fake client wired with the given features (in init order) plus a mini
  # operation pipeline. `features` is a list of {"name"=>..,"options"=>..}.
  class Harness
    attr_reader :client, :utility, :rootctx

    def initialize(features, server: nil, base: "http://api.test", headers: {})
      @base = base
      @headers = headers

      @utility = ZefoyTiktokBotUtility.new
      @utility.fetcher = server || ZefoyTiktokBotFeatureHarness.default_server

      @client = FakeClient.new({ "base" => base, "headers" => headers, "feature" => {} })

      @rootctx = @utility.make_context.call({
        "client" => @client,
        "utility" => @utility,
        "options" => @client.options,
      }, nil)

      # Instantiate + init the requested features (skipping any not present
      # in this SDK). Features self-gate on options["active"].
      features.each do |fspec|
        name = fspec["name"]
        next unless ZefoyTiktokBotFeatureHarness.has_feature?(name)
        f = ZefoyTiktokBotFeatures.make_feature(name)
        fopts = { "active" => true }.merge(fspec["options"] || {})
        @client.options["feature"][name] = fopts
        f.init(@rootctx, fopts)
        @client.features << f
      end

      @booted = false
    end

    def ready
      return if @booted
      @booted = true
      @utility.feature_hook.call(@rootctx, "PostConstruct")
    end

    def feature(name)
      @client.features.find { |f| f.get_name == name }
    end

    def track(ivar)
      @client.instance_variable_get(ivar)
    end

    # Run one operation through the mini pipeline (mirrors the generated
    # entity op fragment: hook, short-circuit, make*, hook, ...).
    def op(opname: "load", entity: "widget", method: nil, path: nil, query: nil,
           headers: nil, body: nil, ctrl: nil)
      method ||= ZefoyTiktokBotFeatureHarness.default_method(opname)

      ctx = @utility.make_context.call({
        "opname" => opname,
        "entity" => FakeEntity.new(entity),
        "ctrl" => ctrl || {},
      }, @rootctx)

      fire(ctx, "PostConstructEntity")

      begin
        fire(ctx, "PrePoint")
        raise ctx.out["point"] if ctx.out["point"].is_a?(ZefoyTiktokBotError)

        fire(ctx, "PreSpec")
        ctx.spec = ZefoyTiktokBotSpec.new({
          "method" => method,
          "base" => @base,
          "path" => path || "/#{entity}",
          "params" => {},
          "headers" => @headers.merge(headers || {}),
          "query" => query || {},
          "body" => body,
          "step" => "start",
        })

        fire(ctx, "PreRequest")
        url = build_url(ctx.spec)
        ctx.spec.url = url

        fetchdef = {
          "url" => url,
          "method" => ctx.spec.method,
          "headers" => ctx.spec.headers,
          "body" => ctx.spec.body,
        }
        fetched, fetch_err = @utility.fetcher.call(ctx, url, fetchdef)

        ctx.response = fetched.is_a?(Hash) ? ZefoyTiktokBotResponse.new(fetched) : nil
        fire(ctx, "PreResponse")

        populate_result(ctx, fetched, fetch_err)
        fire(ctx, "PreResult")
        fire(ctx, "PreDone")

        if ctx.result && ctx.result.ok
          return { "ok" => true, "data" => ctx.result.resdata, "result" => ctx.result, "ctx" => ctx }
        end
        err = (ctx.result && ctx.result.err) || ctx.make_error("op_failed", "operation failed")
        raise err
      rescue ZefoyTiktokBotError => err
        ctx.ctrl.err = err
        fire(ctx, "PreUnexpected")
        { "ok" => false, "error" => err, "result" => ctx.result, "ctx" => ctx }
      end
    end

    private

    def fire(ctx, name)
      @utility.feature_hook.call(ctx, name)
    end

    def build_url(spec)
      q = spec.query || {}
      keys = q.keys.select { |k| !q[k].nil? }.sort
      qs = keys.map { |k|
        "#{VoxgigStruct.escurl(k.to_s)}=#{VoxgigStruct.escurl(q[k].to_s)}"
      }.join("&")
      "#{spec.base}#{spec.path}#{qs.empty? ? '' : '?' + qs}"
    end

    def populate_result(ctx, fetched, fetch_err)
      result = ZefoyTiktokBotResult.new({})
      ctx.result = result

      if fetch_err
        result.err = fetch_err
        return
      end
      if fetched.nil?
        result.err = ctx.make_error("op_no_response", "response: undefined")
        return
      end

      response = ctx.response
      result.status = response.status
      result.status_text = response.status_text
      headers = {}
      if response.headers.is_a?(Hash)
        response.headers.each { |k, v| headers[k.to_s.downcase] = v }
      end
      result.headers = headers
      result.body = response.json_func.call if response.json_func
      result.resdata = result.body

      if result.status >= 400
        result.err = ctx.make_error("request_status",
          "request: #{result.status}: #{result.status_text}")
      end
      result.ok = true if result.err.nil?
    end
  end
end


class FeatureTest < Minitest::Test
  H = ZefoyTiktokBotFeatureHarness

  def harness(features, server: nil, base: "http://api.test", headers: {})
    H::Harness.new(features, server: server, base: base, headers: headers)
  end

  def fspec(name, options = nil)
    { "name" => name, "options" => options || {} }
  end

  def skip_unless_feature(name)
    skip "feature \"#{name}\" not present in this SDK" unless H.has_feature?(name)
  end


  def test_at_least_the_test_feature_is_present
    assert H.has_feature?("test")
  end


  # === netsim ===

  def test_netsim_fixed_latency_then_delegate
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([fspec("netsim", "latency" => 250, "sleep" => clock.sleeper)])
    res = h.op(ctrl: { "explain" => {} })
    assert_equal true, res["ok"]
    assert_equal 250, clock.time
    assert_equal 1, h.track(:@_netsim)["calls"]
  end

  def test_netsim_ranged_latency_samples_within_range
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([fspec("netsim",
      "latency" => { "min" => 100, "max" => 300 }, "seed" => 7, "sleep" => clock.sleeper)])
    h.op
    assert clock.time >= 100 && clock.time < 300, "latency in range, got #{clock.time}"
  end

  def test_netsim_equal_min_max_latency_is_exact
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([fspec("netsim",
      "latency" => { "min" => 50, "max" => 50 }, "sleep" => clock.sleeper)])
    h.op
    assert_equal 50, clock.time
  end

  def test_netsim_fail_times_returns_a_retryable_status
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "failTimes" => 2, "failStatus" => 503)])
    assert_equal 503, h.op["result"].status
    assert_equal 503, h.op["result"].status
    assert_equal true, h.op["ok"]
  end

  def test_netsim_fail_every_fails_every_nth_call
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "failEvery" => 2)])
    assert_equal true, h.op["ok"]
    assert_equal false, h.op["ok"]
    assert_equal true, h.op["ok"]
  end

  def test_netsim_fail_rate_with_a_seed_is_deterministic
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "failRate" => 1, "seed" => 5)])
    assert_equal false, h.op["ok"]
  end

  def test_netsim_error_times_yields_a_connection_error
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "errorTimes" => 1)])
    assert_equal "netsim_conn", h.op["error"].code
  end

  def test_netsim_offline_fails_every_call
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "offline" => true)])
    assert_equal "netsim_offline", h.op["error"].code
  end

  def test_netsim_rate_limit_times_returns_429_and_retry_after
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "rateLimitTimes" => 1, "retryAfter" => 3)])
    res = h.op
    assert_equal 429, res["result"].status
    assert_equal "3", res["result"].headers["retry-after"]
  end

  def test_netsim_inactive_does_not_wrap
    skip_unless_feature("netsim")
    h = harness([fspec("netsim", "active" => false)])
    assert_equal true, h.op["ok"]
    assert_nil h.track(:@_netsim)
  end


  # === retry ===

  def test_retry_retries_transient_failures_then_succeeds
    skip_unless_feature("retry")
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([
      fspec("netsim", "failTimes" => 2, "failStatus" => 503),
      fspec("retry", "retries" => 3, "minDelay" => 10, "jitter" => false, "sleep" => clock.sleeper),
    ])
    assert_equal true, h.op["ok"]
    assert_equal 2, h.track(:@_retry)["attempts"]
  end

  def test_retry_gives_up_after_the_budget
    skip_unless_feature("retry")
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([
      fspec("netsim", "failTimes" => 9, "failStatus" => 500),
      fspec("retry", "retries" => 2, "minDelay" => 1, "jitter" => false, "sleep" => clock.sleeper),
    ])
    assert_equal 500, h.op["result"].status
  end

  def test_retry_does_not_retry_a_non_retryable_status
    skip_unless_feature("retry")
    server, calls = H.recording_server { |_n, _fd| [H.make_response(404), nil] }
    h = harness([fspec("retry", "retries" => 3, "minDelay" => 0, "jitter" => false)],
      server: server)
    h.op
    assert_equal 1, calls.length
  end

  def test_retry_retries_a_transport_error_tuple
    skip_unless_feature("retry")
    clock = H::Clock.new
    server, calls = H.recording_server { |n, _fd|
      n < 3 ? [nil, ZefoyTiktokBotError.new("boom", "boom")] : [H.make_response(200, { "ok" => true }), nil]
    }
    h = harness([fspec("retry",
      "retries" => 2, "minDelay" => 1, "jitter" => false, "sleep" => clock.sleeper)],
      server: server)
    res = h.op
    assert_equal true, res["ok"]
    assert_equal 3, calls.length
  end

  def test_retry_exhausted_transport_error_surfaces
    skip_unless_feature("retry")
    clock = H::Clock.new
    server, calls = H.recording_server { |_n, _fd| [nil, ZefoyTiktokBotError.new("boom", "boom")] }
    h = harness([fspec("retry",
      "retries" => 2, "minDelay" => 1, "jitter" => false, "sleep" => clock.sleeper)],
      server: server)
    res = h.op
    assert_equal false, res["ok"]
    assert_equal 3, calls.length
  end

  def test_retry_honours_a_server_retry_after
    skip_unless_feature("retry")
    skip_unless_feature("netsim")
    clock = H::Clock.new
    h = harness([
      fspec("netsim", "rateLimitTimes" => 1, "retryAfter" => 2),
      fspec("retry", "retries" => 2, "minDelay" => 10, "maxDelay" => 60000,
        "jitter" => false, "sleep" => clock.sleeper),
    ])
    assert_equal true, h.op["ok"]
    assert_equal 2000, clock.time
  end

  def test_retry_inactive_does_not_wrap
    skip_unless_feature("retry")
    server, calls = H.recording_server { |_n, _fd| [H.make_response(503), nil] }
    h = harness([fspec("retry", "active" => false)], server: server)
    h.op
    assert_equal 1, calls.length
  end


  # === timeout ===

  def test_timeout_expires_a_slow_request
    skip_unless_feature("timeout")
    clock = H::Clock.new
    sleeper = clock.sleeper
    server = ->(_fctx, _u, _fd) {
      sleeper.call(80)
      [H.make_response(200, { "ok" => true }), nil]
    }
    h = harness([fspec("timeout", "ms" => 10, "now" => clock.now)], server: server)
    res = h.op
    assert_equal "timeout", res["error"].code
    assert_equal 1, h.track(:@_timeout)["count"]
  end

  def test_timeout_passes_a_fast_request_through
    skip_unless_feature("timeout")
    clock = H::Clock.new
    h = harness([fspec("timeout", "ms" => 1000, "now" => clock.now)])
    assert_equal true, h.op["ok"]
  end

  def test_timeout_ms_zero_disables_the_timeout
    skip_unless_feature("timeout")
    h = harness([fspec("timeout", "ms" => 0)])
    assert_equal true, h.op["ok"]
  end

  def test_timeout_interrupts_a_hanging_transport
    skip_unless_feature("timeout")
    server = ->(_fctx, _u, _fd) {
      sleep(0.05)
      [H.make_response(200, { "ok" => true }), nil]
    }
    h = harness([fspec("timeout", "ms" => 10)], server: server)
    assert_equal "timeout", h.op["error"].code
  end

  def test_timeout_inactive_does_not_wrap
    skip_unless_feature("timeout")
    h = harness([fspec("timeout", "active" => false)])
    assert_equal true, h.op["ok"]
  end


  # === ratelimit ===

  def test_ratelimit_throttles_once_the_burst_is_spent
    skip_unless_feature("ratelimit")
    clock = H::Clock.new
    h = harness([fspec("ratelimit",
      "rate" => 1, "burst" => 2, "now" => clock.now, "sleep" => clock.sleeper)])
    h.op
    h.op
    h.op
    assert_equal 1, h.track(:@_ratelimit)["throttled"]
    assert clock.time > 0
  end

  def test_ratelimit_burst_defaults_to_rate_and_refills_over_time
    skip_unless_feature("ratelimit")
    clock = H::Clock.new
    h = harness([fspec("ratelimit",
      "rate" => 2, "now" => clock.now, "sleep" => clock.sleeper)])
    h.op
    h.op
    clock.advance(1000) # refill
    h.op
    track = h.track(:@_ratelimit)
    assert_equal 0, track.nil? ? 0 : track["throttled"]
  end

  def test_ratelimit_inactive_does_not_wrap
    skip_unless_feature("ratelimit")
    h = harness([fspec("ratelimit", "active" => false)])
    assert_equal true, h.op["ok"]
    assert_nil h.track(:@_ratelimit)
  end


  # === cache ===

  def test_cache_serves_a_repeated_read_from_cache
    skip_unless_feature("cache")
    server, calls = H.recording_server
    h = harness([fspec("cache", "ttl" => 10000)], server: server)
    a = h.op(path: "/w/1")
    b = h.op(path: "/w/1")
    assert_equal 1, calls.length
    assert_equal a["data"], b["data"]
    assert_equal 1, h.track(:@_cache)["hit"]
  end

  def test_cache_does_not_cache_non_get
    skip_unless_feature("cache")
    server, calls = H.recording_server
    h = harness([fspec("cache")], server: server)
    h.op(opname: "create", path: "/w")
    h.op(opname: "create", path: "/w")
    assert_equal 2, calls.length
  end

  def test_cache_does_not_cache_a_non_2xx
    skip_unless_feature("cache")
    server, calls = H.recording_server { |_n, _fd| [H.make_response(500), nil] }
    h = harness([fspec("cache")], server: server)
    h.op(path: "/w")
    h.op(path: "/w")
    assert_equal 2, calls.length
    assert_equal 2, h.track(:@_cache)["bypass"]
  end

  def test_cache_refetches_after_the_ttl
    skip_unless_feature("cache")
    clock = H::Clock.new
    server, calls = H.recording_server
    h = harness([fspec("cache", "ttl" => 1000, "now" => clock.now)], server: server)
    h.op(path: "/w")
    clock.advance(1500)
    h.op(path: "/w")
    assert_equal 2, calls.length
  end

  def test_cache_evicts_the_oldest_entry_past_max
    skip_unless_feature("cache")
    server, calls = H.recording_server
    h = harness([fspec("cache", "ttl" => 10000, "max" => 1)], server: server)
    h.op(path: "/a")
    h.op(path: "/b") # evicts /a
    h.op(path: "/a") # miss again
    assert_equal 3, calls.length
  end

  def test_cache_inactive_does_not_wrap
    skip_unless_feature("cache")
    server, calls = H.recording_server
    h = harness([fspec("cache", "active" => false)], server: server)
    h.op(path: "/x")
    h.op(path: "/x")
    assert_equal 2, calls.length
  end


  # === idempotency ===

  def test_idempotency_adds_a_key_to_mutating_ops
    skip_unless_feature("idempotency")
    server, calls = H.recording_server
    h = harness([fspec("idempotency")], server: server)
    h.op(opname: "create", path: "/w")
    refute_nil calls[0]["fetchdef"]["headers"]["Idempotency-Key"]
    assert_equal 1, h.track(:@_idempotency)["issued"]
  end

  def test_idempotency_adds_a_key_based_on_http_method
    skip_unless_feature("idempotency")
    server, calls = H.recording_server
    h = harness([fspec("idempotency")], server: server)
    h.op(opname: "act", method: "PUT", path: "/w")
    refute_nil calls[0]["fetchdef"]["headers"]["Idempotency-Key"]
  end

  def test_idempotency_leaves_reads_untouched
    skip_unless_feature("idempotency")
    server, calls = H.recording_server
    h = harness([fspec("idempotency")], server: server)
    h.op(path: "/w/1")
    assert_nil calls[0]["fetchdef"]["headers"]["Idempotency-Key"]
  end

  def test_idempotency_preserves_a_caller_key_and_custom_header
    skip_unless_feature("idempotency")
    server, calls = H.recording_server
    h = harness([fspec("idempotency", "header" => "X-Idem")], server: server)
    h.op(opname: "create", path: "/w", headers: { "X-Idem" => "caller-1" })
    assert_equal "caller-1", calls[0]["fetchdef"]["headers"]["X-Idem"]
  end

  def test_idempotency_injected_keygen
    skip_unless_feature("idempotency")
    server, calls = H.recording_server
    h = harness([fspec("idempotency", "keygen" => -> { "K1" })], server: server)
    h.op(opname: "create", path: "/w")
    assert_equal "K1", calls[0]["fetchdef"]["headers"]["Idempotency-Key"]
  end


  # === rbac ===

  def test_rbac_denies_before_any_network_call
    skip_unless_feature("rbac")
    server, calls = H.recording_server
    h = harness([fspec("rbac",
      "rules" => { "widget.remove" => "admin" }, "permissions" => [])], server: server)
    res = h.op(opname: "remove", path: "/w/1")
    assert_equal "rbac_denied", res["error"].code
    assert_equal 0, calls.length
    assert_equal 1, h.track(:@_rbac)["denied"]
  end

  def test_rbac_allows_a_held_permission
    skip_unless_feature("rbac")
    h = harness([fspec("rbac",
      "rules" => { "widget.remove" => "admin" }, "permissions" => ["admin"])])
    assert_equal true, h.op(opname: "remove", path: "/w/1")["ok"]
    assert_equal 1, h.track(:@_rbac)["allowed"]
  end

  def test_rbac_rule_by_op_name_and_wildcard_grant
    skip_unless_feature("rbac")
    h = harness([fspec("rbac", "rules" => { "load" => "read" }, "permissions" => ["*"])])
    assert_equal true, h.op["ok"]
  end

  def test_rbac_no_rule_allows_by_default_and_deny_blocks
    skip_unless_feature("rbac")
    allow = harness([fspec("rbac", "permissions" => [])])
    assert_equal true, allow.op["ok"]
    deny = harness([fspec("rbac", "deny" => true, "permissions" => [])])
    assert_equal "rbac_denied", deny.op["error"].code
  end


  # === metrics ===

  def test_metrics_counts_ok_and_err_per_op
    skip_unless_feature("metrics")
    skip_unless_feature("netsim")
    h = harness([
      fspec("netsim", "failTimes" => 1, "failStatus" => 500),
      fspec("metrics"),
    ])
    h.op
    h.op
    h.op(opname: "list")
    m = h.track(:@_metrics)
    assert_equal 3, m["total"]["count"]
    assert_equal 2, m["total"]["ok"]
    assert_equal 1, m["total"]["err"]
    assert_equal 2, m["ops"]["widget.load"]["count"]
  end

  def test_metrics_injected_clock
    skip_unless_feature("metrics")
    t = 0
    h = harness([fspec("metrics", "now" => -> { t += 10 })])
    h.op
    m = h.track(:@_metrics)
    assert_equal 1, m["total"]["count"]
    assert_equal 10, m["total"]["totalMs"]
    assert_equal 10, m["total"]["maxMs"]
  end


  # === telemetry ===

  def test_telemetry_opens_spans_and_propagates_trace_headers
    skip_unless_feature("telemetry")
    server, calls = H.recording_server
    spans = []
    h = harness([fspec("telemetry", "exporter" => ->(s) { spans << s })], server: server)
    res = h.op
    assert_equal true, res["ok"]
    t = h.track(:@_telemetry)
    assert_equal 1, t["spans"].length
    assert_equal 1, spans.length
    sent = calls[0]["fetchdef"]["headers"]
    assert_equal t["spans"][0]["traceId"], sent["X-Trace-Id"]
    assert_match(/\A00-.+-.+-01\z/, sent["traceparent"])
  end

  def test_telemetry_records_a_failed_span_on_error
    skip_unless_feature("telemetry")
    skip_unless_feature("netsim")
    h = harness([
      fspec("netsim", "failTimes" => 1, "failStatus" => 500),
      fspec("telemetry"),
    ])
    h.op
    t = h.track(:@_telemetry)
    assert_equal false, t["spans"][0]["ok"]
    assert_equal 0, t["active"]
  end

  def test_telemetry_injected_idgen_and_clock
    skip_unless_feature("telemetry")
    h = harness([fspec("telemetry",
      "idgen" => ->(k) { "#{k}-X" }, "now" => -> { 5 })])
    h.op
    span = h.track(:@_telemetry)["spans"][0]
    assert_equal "trace-X", span["traceId"]
    assert_equal 0, span["durationMs"]
  end


  # === debug ===

  def test_debug_captures_a_redacted_trace_and_honours_on_entry_and_max
    skip_unless_feature("debug")
    seen = []
    h = harness([fspec("debug", "max" => 1, "on_entry" => ->(e) { seen << e })])
    h.op(headers: { "authorization" => "Bearer secret" })
    h.op(opname: "list")
    entries = h.track(:@_debug)["entries"]
    assert_equal 1, entries.length # ring buffer capped at max
    assert_equal 2, seen.length
    assert_equal "<redacted>", seen[0]["headers"]["authorization"]
  end

  def test_debug_captures_failures
    skip_unless_feature("debug")
    skip_unless_feature("netsim")
    h = harness([
      fspec("netsim", "failTimes" => 1, "failStatus" => 500),
      fspec("debug"),
    ])
    h.op
    entry = h.track(:@_debug)["entries"][0]
    assert_equal false, entry["ok"]
    assert_equal 500, entry["status"]
  end

  def test_debug_injected_clock_and_custom_redact
    skip_unless_feature("debug")
    h = harness([fspec("debug", "now" => -> { 7 }, "redact" => ["x-secret"])])
    h.op(headers: { "x-secret" => "hide", "x-ok" => "show" })
    entry = h.track(:@_debug)["entries"][0]
    assert_equal "<redacted>", entry["headers"]["x-secret"]
    assert_equal "show", entry["headers"]["x-ok"]
  end


  # === audit ===

  def test_audit_one_record_per_op_with_sink_and_actor
    skip_unless_feature("audit")
    skip_unless_feature("netsim")
    sink = []
    h = harness([
      fspec("netsim", "failTimes" => 1, "failStatus" => 500),
      fspec("audit", "actor" => "svc", "sink" => ->(r) { sink << r }, "max" => 5),
    ])
    h.op(opname: "remove", path: "/w/1")
    h.op(ctrl: { "actor" => "per-call" })
    recs = h.track(:@_audit)["records"]
    assert_equal 2, recs.length
    assert_equal "error", recs[0]["outcome"]
    assert_equal "svc", recs[0]["actor"]
    assert_equal "per-call", recs[1]["actor"]
    assert_equal "ok", recs[1]["outcome"]
    assert_equal 2, sink.length
  end

  def test_audit_default_actor_and_injected_clock
    skip_unless_feature("audit")
    h = harness([fspec("audit", "now" => -> { 42 })])
    h.op
    rec = h.track(:@_audit)["records"][0]
    assert_equal "anonymous", rec["actor"]
    assert_equal 42, rec["ts"]
  end

  def test_audit_bounds_the_record_list
    skip_unless_feature("audit")
    h = harness([fspec("audit", "max" => 2)])
    h.op
    h.op
    h.op
    recs = h.track(:@_audit)["records"]
    assert_equal 2, recs.length
    assert_equal [2, 3], recs.map { |r| r["seq"] }
  end


  # === clienttrack ===

  def test_clienttrack_stable_client_id_unique_request_ids_and_ua
    skip_unless_feature("clienttrack")
    server, calls = H.recording_server
    h = harness([fspec("clienttrack",
      "clientName" => "Acme", "clientVersion" => "2.0.0")], server: server)
    h.ready
    h.op
    h.op
    h0 = calls[0]["fetchdef"]["headers"]
    h1 = calls[1]["fetchdef"]["headers"]
    assert_equal "Acme/2.0.0", h0["User-Agent"]
    assert_equal h0["X-Client-Id"], h1["X-Client-Id"]
    refute_equal h0["X-Request-Id"], h1["X-Request-Id"]
    assert_equal 2, h.track(:@_clienttrack)["requests"]
  end

  def test_clienttrack_does_not_clobber_a_caller_user_agent
    skip_unless_feature("clienttrack")
    server, calls = H.recording_server
    h = harness([fspec("clienttrack")], server: server)
    h.ready
    h.op(headers: { "User-Agent" => "mine" })
    assert_equal "mine", calls[0]["fetchdef"]["headers"]["User-Agent"]
  end

  def test_clienttrack_injected_idgen_and_fixed_session
    skip_unless_feature("clienttrack")
    server, calls = H.recording_server
    h = harness([fspec("clienttrack",
      "sessionId" => "S1", "idgen" => ->(k) { "#{k}-1" })], server: server)
    h.ready
    h.op
    assert_equal "S1", calls[0]["fetchdef"]["headers"]["X-Client-Id"]
    assert_equal "request-1", calls[0]["fetchdef"]["headers"]["X-Request-Id"]
  end

  def test_clienttrack_lazily_creates_the_session_id
    skip_unless_feature("clienttrack")
    server, calls = H.recording_server
    h = harness([fspec("clienttrack")], server: server)
    # no ready() -> PreRequest lazily creates the session id
    h.op
    refute_nil calls[0]["fetchdef"]["headers"]["X-Client-Id"]
  end


  # === paging ===

  def test_paging_stamps_page_limit_and_reads_header_signals
    skip_unless_feature("paging")
    server, calls = H.recording_server { |_n, _fd|
      [H.make_response(200, { "items" => [1, 2] },
        "x-next-page" => "2", "x-total-count" => "5",
        "link" => "</w?page=2>; rel=\"next\""), nil]
    }
    h = harness([fspec("paging", "limit" => 2)], server: server)
    res = h.op(opname: "list", path: "/w")
    assert_match(/[?&]page=1(&|\z)/, calls[0]["url"])
    assert_match(/[?&]limit=2(&|\z)/, calls[0]["url"])
    paging = res["result"].paging
    assert_equal 2, paging["nextPage"]
    assert_equal 5, paging["totalCount"]
    assert_equal "/w?page=2", paging["next"]
    assert_equal true, paging["hasMore"]
  end

  def test_paging_body_cursor_and_explicit_cursor_request
    skip_unless_feature("paging")
    server, calls = H.recording_server { |_n, _fd|
      [H.make_response(200, { "nextCursor" => "abc", "hasMore" => true }), nil]
    }
    h = harness([fspec("paging")], server: server)
    res = h.op(opname: "list", path: "/w", ctrl: { "paging" => { "cursor" => "xyz" } })
    assert_match(/[?&]cursor=xyz(&|\z)/, calls[0]["url"])
    assert_equal "abc", res["result"].paging["cursor"]
    assert_equal true, res["result"].paging["hasMore"]
  end

  def test_paging_non_list_op_is_not_paged
    skip_unless_feature("paging")
    server, calls = H.recording_server
    h = harness([fspec("paging")], server: server)
    res = h.op(path: "/w/1")
    refute_match(/[?&]page=/, calls[0]["url"])
    assert_nil res["result"].paging
  end


  # === streaming ===

  def test_streaming_streams_list_items
    skip_unless_feature("streaming")
    clock = H::Clock.new
    server, _calls = H.recording_server { |_n, _fd|
      [H.make_response(200, ["a", "b", "c"]), nil]
    }
    h = harness([fspec("streaming",
      "chunkDelay" => 5, "sleep" => clock.sleeper)], server: server)
    res = h.op(opname: "list", path: "/w")
    assert_equal true, res["result"].streaming
    seen = res["result"].stream.to_a
    assert_equal ["a", "b", "c"], seen
    assert_equal 15, clock.time
    assert_equal 1, h.track(:@_streaming)["opened"]
  end

  def test_streaming_batches_with_chunk_size
    skip_unless_feature("streaming")
    server, _calls = H.recording_server { |_n, _fd|
      [H.make_response(200, [1, 2, 3, 4, 5]), nil]
    }
    h = harness([fspec("streaming", "chunkSize" => 2)], server: server)
    res = h.op(opname: "list", path: "/w")
    assert_equal [[1, 2], [3, 4], [5]], res["result"].stream.to_a
  end

  def test_streaming_non_list_op_is_not_streamed
    skip_unless_feature("streaming")
    h = harness([fspec("streaming")])
    res = h.op
    assert_nil res["result"].streaming
  end


  # === proxy ===

  def test_proxy_routes_and_invokes_an_agent_factory
    skip_unless_feature("proxy")
    server, calls = H.recording_server
    agent_url = nil
    h = harness([fspec("proxy",
      "url" => "http://proxy:8080",
      "agent" => ->(u, _target) { agent_url = u; { "a" => 1 } })], server: server)
    h.op
    assert_equal "http://proxy:8080", calls[0]["fetchdef"]["proxy"]
    assert_equal({ "a" => 1 }, calls[0]["fetchdef"]["dispatcher"])
    assert_equal "http://proxy:8080", agent_url
    assert_equal 1, h.track(:@_proxy)["routed"]
  end

  def test_proxy_bypasses_no_proxy_hosts
    skip_unless_feature("proxy")
    server, calls = H.recording_server
    h = harness([fspec("proxy",
      "url" => "http://proxy:8080", "noProxy" => ["api.test"])],
      server: server, base: "http://api.test")
    h.op
    assert_nil calls[0]["fetchdef"]["proxy"]
  end

  def test_proxy_from_env_reads_https_proxy
    skip_unless_feature("proxy")
    prev = ENV["HTTPS_PROXY"]
    ENV["HTTPS_PROXY"] = "http://env-proxy:8080"
    begin
      server, calls = H.recording_server
      h = harness([fspec("proxy", "fromEnv" => true)], server: server)
      h.op
      assert_equal "http://env-proxy:8080", calls[0]["fetchdef"]["proxy"]
    ensure
      if prev.nil?
        ENV.delete("HTTPS_PROXY")
      else
        ENV["HTTPS_PROXY"] = prev
      end
    end
  end

  def test_proxy_inactive_or_without_url_is_a_no_op
    skip_unless_feature("proxy")
    server, calls = H.recording_server
    h = harness([fspec("proxy", "active" => false)], server: server)
    h.op
    assert_nil calls[0]["fetchdef"]["proxy"]

    server2, calls2 = H.recording_server
    h2 = harness([fspec("proxy")], server: server2)
    h2.op
    assert_nil calls2[0]["fetchdef"]["proxy"]
  end


  # === composition ===

  def test_cache_plus_netsim_a_hit_skips_the_simulated_failure
    skip_unless_feature("cache")
    skip_unless_feature("netsim")
    h = harness([
      fspec("netsim", "failEvery" => 2),
      fspec("cache", "ttl" => 10000),
    ])
    assert_equal true, h.op(path: "/w")["ok"]
    assert_equal true, h.op(path: "/w")["ok"]
    assert_equal 1, h.track(:@_netsim)["calls"]
  end
end
