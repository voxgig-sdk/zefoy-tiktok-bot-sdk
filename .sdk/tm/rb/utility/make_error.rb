# ZefoyTiktokBot SDK utility: make_error
require_relative '../core/operation'
require_relative '../core/result'
require_relative '../core/error'
module ZefoyTiktokBotUtilities
  MakeError = ->(ctx, err) {
    if ctx.nil?
      require_relative '../core/context'
      ctx = ZefoyTiktokBotContext.new({}, nil)
    end
    op = ctx.op || ZefoyTiktokBotOperation.new({})
    opname = op.name
    opname = "unknown operation" if opname.empty? || opname == "_"

    result = ctx.result || ZefoyTiktokBotResult.new({})
    result.ok = false

    err = result.err if err.nil?
    err = ctx.make_error("unknown", "unknown error") if err.nil?

    errmsg = err.is_a?(ZefoyTiktokBotError) ? err.msg : err.to_s
    msg = "ZefoyTiktokBotSDK: #{opname}: #{errmsg}"
    msg = ctx.utility.clean.call(ctx, msg)

    result.err = nil
    spec = ctx.spec

    if ctx.ctrl.explain
      ctx.ctrl.explain["err"] = { "message" => msg }
    end

    sdk_err = ZefoyTiktokBotError.new("", msg, ctx)
    sdk_err.result = ctx.utility.clean.call(ctx, result)
    sdk_err.spec = ctx.utility.clean.call(ctx, spec)
    sdk_err.code = err.code if err.is_a?(ZefoyTiktokBotError)

    ctx.ctrl.err = sdk_err

    # Opt-out escape hatch: when throwing is explicitly disabled, return the
    # bare result data instead of raising.
    if ctx.ctrl.throw_err == false
      return result.resdata
    end
    # Default idiomatic path: raise the already-constructed exception.
    raise sdk_err
  }
end
