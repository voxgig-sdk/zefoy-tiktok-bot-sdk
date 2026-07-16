# ZefoyTiktokBot SDK ratelimit feature
#
# Client-side rate limiting via a token bucket. Each request consumes a
# token; when the bucket is empty the request waits until the bucket
# refills at "rate" tokens per second (with capacity "burst", default:
# rate). This keeps the client under a server's published quota rather than
# discovering it via 429s. The clock ("now", ms) and the wait ("sleep") are
# injectable so the accounting can be tested deterministically.

require_relative 'base_feature'

class ZefoyTiktokBotRatelimitFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "ratelimit"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @tokens = 0
    @last = 0
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    return unless @active

    burst = @options["burst"].nil? ? (@options["rate"] || 5) : @options["burst"]
    @tokens = burst
    @last = _now

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.acquire(fctx)
      inner.call(fctx, fullurl, fetchdef)
    }
  end

  def acquire(ctx)
    rate = @options["rate"] || 5
    burst = @options["burst"].nil? ? rate : @options["burst"]

    # Refill according to elapsed time.
    now = _now
    elapsed = now - @last
    @last = now
    @tokens = [burst, @tokens + (elapsed / 1000.0) * rate].min

    if @tokens >= 1
      @tokens -= 1
      return
    end

    # Not enough tokens: wait for one to accrue, then consume it.
    needed = 1 - @tokens
    wait_ms = ((needed / rate.to_f) * 1000).ceil
    _track(ctx, wait_ms)
    _sleep(wait_ms)
    @last = _now
    @tokens = 0
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
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

  def _track(ctx, wait_ms)
    track = @client.instance_variable_get(:@_ratelimit)
    if track.nil?
      track = { "throttled" => 0, "waitMs" => 0 }
      @client.instance_variable_set(:@_ratelimit, track)
    end
    track["throttled"] += 1
    track["waitMs"] += wait_ms
  end
end
