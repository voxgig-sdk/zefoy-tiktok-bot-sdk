# ZefoyTiktokBot SDK clienttrack feature
#
# Client tracking. Establishes a stable per-client session id at
# construction and stamps identifying headers on every request: a
# "User-Agent" ("<clientName>/<clientVersion>"), an "X-Client-Id"
# (session), and a fresh per-request "X-Request-Id". This lets a server
# correlate all traffic from one SDK instance and each individual call.
# Header names, client name/version and the id generator ("idgen") are
# configurable; caller-provided User-Agent / X-Client-Id values are never
# clobbered.

require_relative 'base_feature'

class ZefoyTiktokBotClienttrackFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "clienttrack"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @session = ""
    @requests = 0
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @requests = 0
  end

  def PostConstruct(ctx)
    return unless @active
    @session = @options["sessionId"] || _genid("session")
    @client.instance_variable_set(:@_clienttrack, {
      "session" => @session,
      "requests" => 0,
      "clientName" => _client_name,
    })
  end

  def PreRequest(ctx)
    return unless @active
    spec = ctx.spec
    return if spec.nil?
    spec.headers = {} if spec.headers.nil?
    if @session == ""
      @session = @options["sessionId"] || _genid("session")
    end

    h = @options["headers"] || {}
    @requests += 1
    request_id = _genid("request")

    _set(spec.headers, h["agent"] || "User-Agent", _client_name)
    _set(spec.headers, h["client"] || "X-Client-Id", @session)
    spec.headers[h["request"] || "X-Request-Id"] = request_id

    track = @client.instance_variable_get(:@_clienttrack)
    if track.nil?
      track = { "session" => @session, "requests" => 0, "clientName" => _client_name }
      @client.instance_variable_set(:@_clienttrack, track)
    end
    track["requests"] = @requests
    track["lastRequestId"] = request_id
  end

  # Do not clobber a caller-provided value (e.g. a custom User-Agent).
  def _set(headers, name, value)
    lower = name.downcase
    headers.each_key do |k|
      return if k.to_s.downcase == lower
    end
    headers[name] = value
  end

  def _client_name
    name = @options["clientName"] || "ZefoyTiktokBot-SDK"
    version = @options["clientVersion"] || "0.0.1"
    "#{name}/#{version}"
  end

  def _genid(kind)
    idgen = @options["idgen"]
    return idgen.call(kind) if idgen.is_a?(Proc)
    h = -> { rand(0x10000000).to_s(16) }
    "#{kind[0]}-#{h.call}#{h.call}#{h.call}"[0, 20]
  end
end
