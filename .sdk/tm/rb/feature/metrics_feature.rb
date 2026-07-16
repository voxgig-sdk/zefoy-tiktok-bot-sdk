# ZefoyTiktokBot SDK metrics feature
#
# Statistics capture. Records per-operation counters and latency for every
# call: totals plus a breakdown keyed by "<entity>.<op>". Timing starts at
# endpoint resolution (PrePoint) and stops when the call returns (PreDone)
# or fails (PreUnexpected) - exactly once per operation. The clock is
# injectable ("now", ms) for deterministic tests.

require_relative 'base_feature'

class ZefoyTiktokBotMetricsFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "metrics"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @starts = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @starts = {}

    return unless @active

    if @client.instance_variable_get(:@_metrics).nil?
      @client.instance_variable_set(:@_metrics, {
        "total" => { "count" => 0, "ok" => 0, "err" => 0, "totalMs" => 0, "maxMs" => 0 },
        "ops" => {},
      })
    end
  end

  def PrePoint(ctx)
    return unless @active
    @starts[ctx] = _now
  end

  def PreDone(ctx)
    return unless @active
    # Classify by the actual result: a 4xx/5xx that flows through still
    # reaches PreDone before the pipeline raises.
    ok = !ctx.result.nil? && ctx.result.ok == true && ctx.result.err.nil?
    _record(ctx, ok)
  end

  def PreUnexpected(ctx)
    return unless @active
    _record(ctx, false)
  end

  def _record(ctx, ok)
    # Record once per operation. When a non-2xx result reaches PreDone the
    # pipeline then raises, firing PreUnexpected too; the missing start
    # marker makes the second call a no-op.
    return unless @starts.key?(ctx)
    start = @starts.delete(ctx)
    dur = start.nil? ? 0 : [0, _now - start].max

    m = @client.instance_variable_get(:@_metrics)
    return if m.nil?
    key = "#{ctx.op ? ctx.op.entity : '_'}.#{ctx.op ? ctx.op.name : '_'}"

    op = m["ops"][key]
    if op.nil?
      op = { "count" => 0, "ok" => 0, "err" => 0, "totalMs" => 0, "maxMs" => 0 }
      m["ops"][key] = op
    end

    _bump(m["total"], ok, dur)
    _bump(op, ok, dur)
  end

  def _bump(bucket, ok, dur)
    bucket["count"] += 1
    bucket[ok ? "ok" : "err"] += 1
    bucket["totalMs"] += dur
    bucket["maxMs"] = dur if dur > bucket["maxMs"]
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end
end
