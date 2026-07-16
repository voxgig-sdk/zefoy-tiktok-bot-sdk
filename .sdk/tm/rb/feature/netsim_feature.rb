# ZefoyTiktokBot SDK netsim feature
#
# Network behaviour simulation. Wraps the active transport (the live HTTP
# fetcher or the test feature's in-memory mock) and injects realistic
# network conditions so offline unit tests can exercise slowness, transient
# failures, rate limiting and outages deterministically.
#
# Every injection mode is counter-driven (per client instance) so tests are
# reproducible without mocking timers. "failRate" adds optional
# pseudo-random failures via a seeded LCG for coverage-style testing.

require_relative 'base_feature'

class ZefoyTiktokBotNetsimFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "netsim"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @calls = 0
    @seed = 1
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @seed = (@options["seed"] || 0).to_i
    @seed = 1 if @seed == 0
    @calls = 0

    return unless @active

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.simulate(fctx, fullurl, fetchdef, inner)
    }
  end

  def simulate(ctx, url, fetchdef, inner)
    opts = @options
    @calls += 1
    call = @calls

    # Record the simulated conditions for test/debug inspection.
    applied = {}

    # Total outage: every call fails at the transport level.
    if opts["offline"] == true
      _sleep(_pick_latency)
      applied["offline"] = true
      _track(ctx, applied)
      return nil, ctx.make_error("netsim_offline",
        "Simulated network offline (URL was: \"#{url}\")")
    end

    # Connection-level errors for the first N calls (e.g. ECONNRESET).
    if call <= (opts["errorTimes"] || 0).to_i
      _sleep(_pick_latency)
      applied["error"] = true
      _track(ctx, applied)
      return nil, ctx.make_error("netsim_conn", "Simulated connection error (call #{call})")
    end

    # Rate-limit responses (HTTP 429 + Retry-After) for the first N calls.
    if call <= (opts["rateLimitTimes"] || 0).to_i
      _sleep(_pick_latency)
      applied["rateLimited"] = true
      _track(ctx, applied)
      return _respond(429, nil, {
        "statusText" => "Too Many Requests",
        "headers" => { "retry-after" => (opts["retryAfter"].nil? ? 0 : opts["retryAfter"]).to_s },
      }), nil
    end

    # Retryable failure status for the first N calls, or every Nth call.
    fail_status = opts["failStatus"].nil? ? 503 : opts["failStatus"]
    fail_by_count = call <= (opts["failTimes"] || 0).to_i
    fail_every = (opts["failEvery"] || 0).to_i
    fail_by_every = fail_every > 0 && (call % fail_every) == 0
    fail_rate = opts["failRate"].is_a?(Numeric) ? opts["failRate"] : 0
    fail_by_rate = fail_rate > 0 && _rand < fail_rate
    if fail_by_count || fail_by_every || fail_by_rate
      _sleep(_pick_latency)
      applied["failStatus"] = fail_status
      _track(ctx, applied)
      return _respond(fail_status, nil, { "statusText" => "Simulated Failure" }), nil
    end

    # Otherwise: apply latency then delegate to the real transport.
    latency = _pick_latency
    applied["latency"] = latency
    _track(ctx, applied)
    _sleep(latency)
    inner.call(ctx, url, fetchdef)
  end

  # Latency in ms: a fixed number, or a uniform sample from {min,max}.
  def _pick_latency
    l = @options["latency"]
    return 0 if l.nil?
    return (l < 0 ? 0 : l) if l.is_a?(Numeric)
    min = (l["min"] || 0).to_i
    max = l["max"].nil? ? min : l["max"].to_i
    return min if max <= min
    min + (_rand * (max - min)).floor
  end

  def _sleep(ms)
    return if ms.nil? || ms <= 0
    s = @options["sleep"]
    if s.is_a?(Proc)
      s.call(ms)
    else
      sleep(ms / 1000.0)
    end
  end

  # Deterministic 0..1 pseudo-random via a linear congruential generator.
  def _rand
    @seed = (@seed * 1103515245 + 12345) & 0x7fffffff
    @seed.to_f / 0x7fffffff
  end

  def _track(ctx, applied)
    track = @client.instance_variable_get(:@_netsim)
    if track.nil?
      track = { "calls" => 0, "applied" => [] }
      @client.instance_variable_set(:@_netsim, track)
    end
    track["calls"] += 1
    track["applied"] << applied
    if ctx.ctrl && ctx.ctrl.explain
      ctx.ctrl.explain["netsim"] = track
    end
  end

  # Build a transport-shaped response (matching the test feature's mock)
  # that the result pipeline understands.
  def _respond(status, data, extra)
    out = {
      "status" => status,
      "statusText" => "OK",
      "json" => -> { data },
      "body" => "not-used",
      "headers" => {},
    }
    if extra.is_a?(Hash)
      extra.each do |k, v|
        if k == "headers" && v.is_a?(Hash)
          headers = {}
          v.each { |hk, hv| headers[hk.to_s.downcase] = hv }
          out["headers"] = headers
        else
          out[k] = v
        end
      end
    end
    out
  end
end
