# ZefoyTiktokBot SDK telemetry feature
#
# Distributed-tracing telemetry. Opens a span per operation (PrePoint),
# propagates trace context to the server as W3C "traceparent" plus
# "X-Trace-Id" / "X-Span-Id" headers (PreRequest), and closes the span on
# completion (PreDone) or failure (PreUnexpected) - exactly once. Finished
# spans are kept on the client; an "exporter" callback, when provided, is
# invoked with each finished span. Trace/span id generation ("idgen") and
# the clock ("now", ms) are injectable for deterministic tests.

require_relative 'base_feature'

class ZefoyTiktokBotTelemetryFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "telemetry"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @spans = {}
    @seq = 0
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @spans = {}
    @seq = 0

    return unless @active

    if @client.instance_variable_get(:@_telemetry).nil?
      @client.instance_variable_set(:@_telemetry, { "spans" => [], "active" => 0 })
    end
  end

  def PrePoint(ctx)
    return unless @active
    span = {
      "traceId" => _id("trace"),
      "spanId" => _id("span"),
      "name" => "#{ctx.op ? ctx.op.entity : '_'}.#{ctx.op ? ctx.op.name : '_'}",
      "start" => _now,
      "end" => nil,
      "durationMs" => nil,
      "ok" => nil,
    }
    @spans[ctx] = span
    t = _telemetry
    t["active"] += 1 unless t.nil?
  end

  def PreRequest(ctx)
    return unless @active
    span = @spans[ctx]
    spec = ctx.spec
    return if span.nil? || spec.nil?
    spec.headers = {} if spec.headers.nil?
    h = @options["headers"] || {}
    spec.headers[h["trace"] || "X-Trace-Id"] = span["traceId"]
    spec.headers[h["span"] || "X-Span-Id"] = span["spanId"]
    spec.headers[h["parent"] || "traceparent"] =
      "00-#{span['traceId']}-#{span['spanId']}-01"
  end

  def PreDone(ctx)
    return unless @active
    ok = !ctx.result.nil? && ctx.result.ok == true && ctx.result.err.nil?
    _close(ctx, ok)
  end

  def PreUnexpected(ctx)
    return unless @active
    _close(ctx, false)
  end

  def _close(ctx, ok)
    # Close once per operation; a PreDone followed by a pipeline raise
    # (non-2xx) fires PreUnexpected too, which then finds no open span.
    span = @spans.delete(ctx)
    return if span.nil?
    span["end"] = _now
    span["durationMs"] = [0, span["end"] - span["start"]].max
    span["ok"] = ok

    t = _telemetry
    unless t.nil?
      t["active"] -= 1
      t["spans"] << span
    end

    exporter = @options["exporter"]
    if exporter.is_a?(Proc)
      begin
        exporter.call(span)
      rescue StandardError
      end
    end
  end

  def _telemetry
    @client.instance_variable_get(:@_telemetry)
  end

  def _id(kind)
    idgen = @options["idgen"]
    return idgen.call(kind) if idgen.is_a?(Proc)
    # Deterministic-ish sequential id; unique within a client instance.
    @seq += 1
    n = @seq.to_s(16).rjust(4, "0")
    (kind == "trace" ? "t" : "s") + n.ljust(16, "0")
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end
end
