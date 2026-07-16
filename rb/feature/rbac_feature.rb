# ZefoyTiktokBot SDK rbac feature
#
# Client-side role/permission enforcement. Before an operation resolves its
# endpoint, the required permission for that entity+operation is checked
# against the permissions the client holds; a disallowed call is
# short-circuited with an "rbac_denied" error and never touches the
# network. Required permissions come from "rules" (keyed by
# "<entity>.<op>", "<op>", or "*"); the default when no rule matches is
# controlled by "deny" (default: allow when unspecified). Held permissions
# are the "permissions" list (a "*" grants everything).

require_relative 'base_feature'

class ZefoyTiktokBotRbacFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "rbac"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
    @granted = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true

    @granted = {}
    perms = @options["permissions"]
    if perms.is_a?(Array)
      perms.each { |p| @granted[p] = true }
    end
  end

  def PrePoint(ctx)
    return unless @active

    required = _required(ctx)
    if required.nil?
      # No rule: honour the default policy.
      return _reject(ctx, "<default-deny>") if @options["deny"] == true
      return
    end

    if @granted["*"] || @granted[required]
      _track(ctx, required, true)
      return
    end

    _reject(ctx, required)
  end

  def _required(ctx)
    rules = @options["rules"] || {}
    entity = ""
    if ctx.entity && ctx.entity.respond_to?(:get_name)
      entity = ctx.entity.get_name
    elsif ctx.op
      entity = ctx.op.entity
    end
    opname = ctx.op ? ctx.op.name : ""

    return rules["#{entity}.#{opname}"] unless rules["#{entity}.#{opname}"].nil?
    return rules[opname] unless rules[opname].nil?
    return rules["*"] unless rules["*"].nil?
    nil
  end

  def _reject(ctx, required)
    _track(ctx, required, false)
    opname = (ctx.op && !ctx.op.name.empty?) ? ctx.op.name : "?"
    err = ctx.make_error("rbac_denied",
      "Permission \"#{required}\" required for operation \"#{opname}\"")
    # Short-circuit endpoint resolution; make_point surfaces this error
    # before any network use.
    ctx.out["point"] = err
    err
  end

  def _track(ctx, required, allowed)
    track = @client.instance_variable_get(:@_rbac)
    if track.nil?
      track = { "allowed" => 0, "denied" => 0, "last" => nil }
      @client.instance_variable_set(:@_rbac, track)
    end
    track[allowed ? "allowed" : "denied"] += 1
    track["last"] = {
      "required" => required,
      "allowed" => allowed,
      "op" => ctx.op ? ctx.op.name : nil,
    }
  end
end
