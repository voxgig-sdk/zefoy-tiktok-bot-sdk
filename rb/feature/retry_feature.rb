# ZefoyTiktokBot SDK retry feature
#
# Automatic retry of transient failures with exponential backoff and
# jitter. Wraps the active transport so a single operation call may make
# several HTTP attempts. A failure is retryable when the transport returns
# an error, or responds with a status in "statuses"
# (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
# "Retry-After" header overrides the computed backoff.

require_relative 'base_feature'

class ZefoyTiktokBotRetryFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "retry"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    return unless @active

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.with_retry(fctx, fullurl, fetchdef, inner)
    }
  end

  def with_retry(ctx, url, fetchdef, inner)
    max = @options["retries"].nil? ? 2 : @options["retries"].to_i
    min_delay = @options["minDelay"].nil? ? 50 : @options["minDelay"]
    max_delay = @options["maxDelay"].nil? ? 2000 : @options["maxDelay"]
    factor = @options["factor"].nil? ? 2 : @options["factor"]

    attempt = 0
    loop do
      res, err = inner.call(ctx, url, fetchdef)

      retryable = _retryable(res, err)
      if !retryable || attempt >= max
        # Out of attempts: return the last response/error tuple to preserve
        # pipeline semantics.
        return res, err
      end

      wait = _backoff(res, attempt, min_delay, max_delay, factor)
      _track(ctx, attempt + 1, res, err, wait)
      _sleep(wait)
      attempt += 1
    end
  end

  def _retryable(res, err)
    return true unless err.nil?
    return true if res.nil?
    status = res.is_a?(Hash) ? res["status"] : nil
    return false unless status.is_a?(Numeric)
    statuses = @options["statuses"] || [408, 425, 429, 500, 502, 503, 504]
    statuses.include?(status.to_i)
  end

  def _backoff(res, attempt, min_delay, max_delay, factor)
    # Honour a server-provided Retry-After (seconds) when present.
    ra = _retry_after(res)
    return [max_delay, ra].min unless ra.nil?
    base = min_delay * (factor**attempt)
    jitter = @options["jitter"] == false ? 0 : (rand * min_delay).floor
    [max_delay, base + jitter].min
  end

  def _retry_after(res)
    return nil unless res.is_a?(Hash)
    headers = res["headers"]
    return nil unless headers.is_a?(Hash)
    v = nil
    headers.each { |k, hv| v = hv if k.to_s.downcase == "retry-after" }
    return nil if v.nil?
    n = Float(v.to_s, exception: false)
    n.nil? ? nil : (n * 1000).to_i
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

  def _track(ctx, attempt, res, err, wait)
    track = @client.instance_variable_get(:@_retry)
    if track.nil?
      track = { "attempts" => 0, "retries" => [] }
      @client.instance_variable_set(:@_retry, track)
    end
    track["attempts"] += 1
    track["retries"] << {
      "attempt" => attempt,
      "status" => res.is_a?(Hash) ? res["status"] : nil,
      "error" => err.nil? ? nil : err.to_s,
      "wait" => wait,
    }
  end
end
