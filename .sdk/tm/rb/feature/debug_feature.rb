# ZefoyTiktokBot SDK debug feature
#
# Request/response capture for debugging. Records a bounded ring buffer of
# per-operation traces - method, URL, redacted headers, response status and
# timing. Sensitive header values (matching "redact", default
# authorization/cookie/api-key style names) are masked. An optional
# "on_entry" callback receives each finished entry (e.g. to stream to a
# console). "max" caps the buffer (default 100). The clock is injectable
# ("now", ms) for deterministic tests.

require_relative 'base_feature'

class ZefoyTiktokBotDebugFeature < ZefoyTiktokBotBaseFeature
  REDACT_DEFAULT = [
    "authorization", "cookie", "set-cookie", "api-key", "apikey",
    "x-api-key", "idempotency-key",
  ].freeze

  def initialize
    super
    @version = "0.0.1"
    @name = "debug"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @entries = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @entries = {}

    return unless @active

    if @client.instance_variable_get(:@_debug).nil?
      @client.instance_variable_set(:@_debug, { "entries" => [] })
    end
  end

  def PreRequest(ctx)
    return unless @active
    spec = ctx.spec
    url = nil
    method = nil
    headers = nil
    if spec
      url = spec.url.to_s.empty? ? spec.path : spec.url
      method = spec.method
      headers = spec.headers
    end
    entry = {
      "op" => "#{ctx.op ? ctx.op.entity : '_'}.#{ctx.op ? ctx.op.name : '_'}",
      "method" => method,
      "url" => url,
      "headers" => _redact(headers),
      "start" => _now,
      "status" => nil,
      "ok" => nil,
      "durationMs" => nil,
      "error" => nil,
    }
    @entries[ctx] = entry
  end

  def PreResponse(ctx)
    return unless @active
    entry = @entries[ctx]
    return if entry.nil?
    response = ctx.response
    unless response.nil?
      entry["status"] = response.status
      if (entry["url"].nil? || entry["url"].to_s.empty?) && ctx.spec
        entry["url"] = ctx.spec.url
      end
    end
  end

  def PreDone(ctx)
    return unless @active
    _finish(ctx, true)
  end

  def PreUnexpected(ctx)
    return unless @active
    entry = @entries[ctx]
    if !entry.nil? && ctx.ctrl && ctx.ctrl.err
      entry["error"] = ctx.ctrl.err.to_s
    end
    _finish(ctx, false)
  end

  def _finish(ctx, ok)
    entry = @entries.delete(ctx)
    return if entry.nil?
    entry["ok"] = ok && (ctx.result.nil? || ctx.result.ok == true)
    entry["durationMs"] = [0, _now - entry["start"]].max
    if entry["status"].nil? && !ctx.result.nil?
      entry["status"] = ctx.result.status
    end

    track = @client.instance_variable_get(:@_debug)
    if track.nil?
      track = { "entries" => [] }
      @client.instance_variable_set(:@_debug, track)
    end
    buf = track["entries"]
    buf << entry
    max = @options["max"].nil? ? 100 : @options["max"]
    buf.shift while buf.length > max

    on_entry = @options["on_entry"]
    if on_entry.is_a?(Proc)
      begin
        on_entry.call(entry)
      rescue StandardError
      end
    end
  end

  def _redact(headers)
    return {} if headers.nil?
    patterns = @options["redact"] || REDACT_DEFAULT
    out = {}
    headers.each do |k, v|
      out[k] = patterns.include?(k.to_s.downcase) ? "<redacted>" : v
    end
    out
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end
end
