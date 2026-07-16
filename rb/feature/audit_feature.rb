# ZefoyTiktokBot SDK audit feature
#
# Audit trail. Emits a structured record for every operation - who (actor),
# what (entity + op), the outcome, and a correlation id - suitable for
# compliance logging. Records accumulate on the client (bounded by "max",
# default 1000) and, when a "sink" callback is supplied, are also pushed to
# it (e.g. to forward to a SIEM). The actor is taken from a per-call
# ctrl actor, then options "actor", then "anonymous". Timestamps use the
# injectable "now" clock (ms) so tests stay deterministic. One record per
# operation (emit-once).

require_relative 'base_feature'

class ZefoyTiktokBotAuditFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "audit"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @seq = 0
    @seen = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
    @seq = 0
    @seen = {}

    return unless @active

    if @client.instance_variable_get(:@_audit).nil?
      @client.instance_variable_set(:@_audit, { "records" => [] })
    end
  end

  def PreDone(ctx)
    return unless @active
    # Outcome reflects the actual result: a non-2xx reaches PreDone before
    # the pipeline raises.
    ok = !ctx.result.nil? && ctx.result.ok == true && ctx.result.err.nil?
    _emit(ctx, ok ? "ok" : "error")
  end

  def PreUnexpected(ctx)
    return unless @active
    _emit(ctx, "error")
  end

  def _emit(ctx, outcome)
    # One record per operation (PreDone + a following PreUnexpected on a
    # non-2xx must not double-log).
    return if @seen.key?(ctx)
    @seen[ctx] = true
    @seq += 1

    record = {
      "seq" => @seq,
      "ts" => _now,
      "actor" => _actor(ctx),
      "entity" => ctx.op ? ctx.op.entity : "_",
      "op" => ctx.op ? ctx.op.name : "_",
      "outcome" => outcome,
      "status" => ctx.result ? ctx.result.status : nil,
      "correlationId" => ctx.id,
    }

    track = @client.instance_variable_get(:@_audit)
    if track.nil?
      track = { "records" => [] }
      @client.instance_variable_set(:@_audit, track)
    end
    recs = track["records"]
    recs << record
    max = @options["max"].nil? ? 1000 : @options["max"]
    recs.shift while recs.length > max

    sink = @options["sink"]
    if sink.is_a?(Proc)
      begin
        sink.call(record)
      rescue StandardError
      end
    end
  end

  def _actor(ctx)
    if ctx.ctrl && ctx.ctrl.respond_to?(:actor) && !ctx.ctrl.actor.nil?
      return ctx.ctrl.actor
    end
    @options["actor"] || "anonymous"
  end

  def _now
    now = @options["now"]
    return now.call if now.is_a?(Proc)
    (Time.now.to_f * 1000).to_i
  end
end
