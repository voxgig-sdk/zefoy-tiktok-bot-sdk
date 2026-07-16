# ZefoyTiktokBot SDK cache feature
#
# Response caching for safe (read) requests. Wraps the active transport and
# serves a fresh cached snapshot instead of hitting the network when the
# same method+URL was fetched within "ttl" ms (default 5000). Only
# successful (2xx) responses to cacheable methods (default: GET) are
# stored, keyed by method+URL. The cache is bounded ("max" entries, default
# 256, oldest evicted first) and every hit/miss/bypass is counted for
# inspection. Replayed responses expose a re-readable "json" body.

require_relative 'base_feature'

class ZefoyTiktokBotCacheFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "cache"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @store = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    return unless @active

    @store = {}

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      feature.through(fctx, fullurl, fetchdef, inner)
    }
  end

  def through(ctx, url, fetchdef, inner)
    method = ((fetchdef.is_a?(Hash) && fetchdef["method"]) || "GET").to_s.upcase
    methods = @options["methods"] || ["GET"]

    return inner.call(ctx, url, fetchdef) unless methods.include?(method)

    key = "#{method} #{url}"
    now = _now
    hit = @store[key]

    if !hit.nil? && hit["expiry"] > now
      _track("hit")
      return _replay(hit["snapshot"]), nil
    end

    res, err = inner.call(ctx, url, fetchdef)

    if err.nil? && _cacheable(res)
      snapshot = _snapshot(res)
      ttl = @options["ttl"].nil? ? 5000 : @options["ttl"]
      _evict
      @store[key] = { "expiry" => now + ttl, "snapshot" => snapshot }
      _track("miss")
      return _replay(snapshot), nil
    end

    _track("bypass")
    return res, err
  end

  def _cacheable(res)
    return false unless res.is_a?(Hash)
    status = res["status"]
    status.is_a?(Numeric) && status >= 200 && status < 300
  end

  def _snapshot(res)
    data = nil
    jf = res["json"]
    if jf.is_a?(Proc)
      begin
        data = jf.call
      rescue StandardError
        data = nil
      end
    end
    headers = res["headers"].is_a?(Hash) ? res["headers"].dup : {}
    {
      "status" => res["status"],
      "statusText" => res["statusText"],
      "data" => data,
      "headers" => headers,
    }
  end

  def _replay(snapshot)
    data = snapshot["data"]
    {
      "status" => snapshot["status"],
      "statusText" => snapshot["statusText"],
      "body" => "not-used",
      "json" => -> { data },
      "headers" => snapshot["headers"].is_a?(Hash) ? snapshot["headers"].dup : {},
    }
  end

  def _evict
    # Ruby hashes preserve insertion order, so the first key is the oldest.
    max = @options["max"].nil? ? 256 : @options["max"]
    while @store.size >= max
      oldest = @store.keys.first
      break if oldest.nil?
      @store.delete(oldest)
    end
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end

  def _track(kind)
    track = @client.instance_variable_get(:@_cache)
    if track.nil?
      track = { "hit" => 0, "miss" => 0, "bypass" => 0 }
      @client.instance_variable_set(:@_cache, track)
    end
    track[kind] += 1
  end
end
