# ZefoyTiktokBot SDK idempotency feature
#
# Idempotency keys for mutating operations. Adds an "Idempotency-Key"
# header (name configurable via "header") to unsafe requests so a server
# can de-duplicate retried writes. The key is set once, at PreRequest,
# before the request is built - so it is stable across transport-level
# retries of the same call. A caller-supplied header is never overwritten
# (case-insensitive). The key generator is injectable via "keygen".

require_relative 'base_feature'

class ZefoyTiktokBotIdempotencyFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "idempotency"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
  end

  def PreRequest(ctx)
    return unless @active
    spec = ctx.spec
    return if spec.nil?

    return unless _mutating(ctx)

    header = @options["header"] || "Idempotency-Key"
    spec.headers = {} if spec.headers.nil?

    # Respect a key the caller already provided.
    return unless _existing(spec.headers, header).nil?

    key = _genkey
    spec.headers[header] = key

    track = @client.instance_variable_get(:@_idempotency)
    if track.nil?
      track = { "issued" => 0, "last" => nil }
      @client.instance_variable_set(:@_idempotency, track)
    end
    track["issued"] += 1
    track["last"] = key
  end

  def _mutating(ctx)
    methods = @options["methods"] || ["POST", "PUT", "PATCH", "DELETE"]
    method = ""
    method = ctx.spec.method.to_s.upcase if ctx.spec && ctx.spec.method
    return true if !method.empty? && methods.include?(method)
    opname = ctx.op ? ctx.op.name : nil
    ops = @options["ops"] || ["create", "update", "remove"]
    ops.include?(opname)
  end

  def _existing(headers, header)
    lower = header.downcase
    headers.each do |k, v|
      return v if k.to_s.downcase == lower
    end
    nil
  end

  def _genkey
    keygen = @options["keygen"]
    return keygen.call if keygen.is_a?(Proc)
    h = -> { rand(0x10000000).to_s(16) }
    (h.call + h.call + h.call + h.call).ljust(24, "0")[0, 24]
  end
end
