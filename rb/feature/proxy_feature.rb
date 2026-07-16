# ZefoyTiktokBot SDK proxy feature
#
# Outbound HTTP(S) proxy support. Wraps the active transport and attaches
# proxy routing to each request's fetch definition. The proxy target comes
# from options ("url") or, when "fromEnv" is set, the standard
# HTTPS_PROXY / HTTP_PROXY / NO_PROXY environment variables. Constructing a
# concrete agent is dependency-specific, so a factory may be supplied via
# options "agent"; when absent the request is annotated with
# fetchdef["proxy"] for the transport to honour. Hosts matching "noProxy"
# (exact or suffix) bypass the proxy.

require_relative 'base_feature'

class ZefoyTiktokBotProxyFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "proxy"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @url = nil
    @no_proxy = []
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    return unless @active

    @url = @options["url"]
    no_proxy = @options["noProxy"]

    if @options["fromEnv"] == true
      @url = @url || ENV["HTTPS_PROXY"] || ENV["https_proxy"] ||
        ENV["HTTP_PROXY"] || ENV["http_proxy"]
      no_proxy = no_proxy || ENV["NO_PROXY"] || ENV["no_proxy"]
    end

    @no_proxy = (no_proxy.is_a?(String) ? no_proxy.split(/\s*,\s*/) : (no_proxy || []))
      .reject { |s| s.nil? || s == "" }

    feature = self
    utility = ctx.utility
    inner = utility.fetcher

    utility.fetcher = ->(fctx, fullurl, fetchdef) {
      inner.call(fctx, fullurl, feature.route(fullurl, fetchdef))
    }
  end

  def route(url, fetchdef)
    return fetchdef if @url.nil? || _bypass(url)

    out = fetchdef.is_a?(Hash) ? fetchdef.dup : {}
    out["proxy"] = @url

    agent = @options["agent"]
    if agent.is_a?(Proc)
      # Factory returns a transport-specific agent/dispatcher.
      made = agent.call(@url, url)
      out["dispatcher"] = made
      out["agent"] = made
    end

    _track(url)
    out
  end

  def _bypass(url)
    return false if @no_proxy.empty?
    host = url
    m = %r{\A[a-z]+://([^/:]+)}i.match(url)
    host = m[1] if m
    @no_proxy.each do |np|
      return true if np == "*"
      return true if host == np || host.end_with?("." + np.sub(/\A\./, ""))
    end
    false
  end

  def _track(url)
    track = @client.instance_variable_get(:@_proxy)
    if track.nil?
      track = { "routed" => 0, "url" => @url }
      @client.instance_variable_set(:@_proxy, track)
    end
    track["routed"] += 1
  end
end
