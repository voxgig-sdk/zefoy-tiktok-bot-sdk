# ZefoyTiktokBot SDK timeout feature
#
# Per-request timeout. Wraps the active transport with a deadline of "ms"
# milliseconds (default 30000; <= 0 disables). The transport is synchronous
# (Net::HTTP), so a hanging request is interrupted with Ruby's Timeout
# module; when an injectable "now" clock is supplied the elapsed wall-clock
# time is checked instead, so tests can assert the deadline
# deterministically. Expiry yields an error with code "timeout".

require 'timeout'

require_relative 'base_feature'

class ZefoyTiktokBotTimeoutFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "timeout"
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
      feature.with_timeout(fctx, fullurl, fetchdef, inner)
    }
  end

  def with_timeout(ctx, url, fetchdef, inner)
    ms = @options["ms"].nil? ? 30000 : @options["ms"]
    return inner.call(ctx, url, fetchdef) if ms <= 0

    now = @options["now"]
    if now.is_a?(Proc)
      # Deterministic path: measure the (virtual) clock around the call.
      start = now.call
      res, err = inner.call(ctx, url, fetchdef)
      if now.call - start > ms
        _track(ctx, ms)
        return nil, ctx.make_error("timeout", "Request exceeded timeout of #{ms}ms")
      end
      return res, err
    end

    # Live path: interrupt a hanging synchronous transport.
    begin
      Timeout.timeout(ms / 1000.0) { inner.call(ctx, url, fetchdef) }
    rescue Timeout::Error
      _track(ctx, ms)
      return nil, ctx.make_error("timeout", "Request exceeded timeout of #{ms}ms")
    end
  end

  def _track(ctx, ms)
    track = @client.instance_variable_get(:@_timeout)
    if track.nil?
      track = { "count" => 0, "ms" => ms }
      @client.instance_variable_set(:@_timeout, track)
    end
    track["count"] += 1
  end
end
