# ZefoyTiktokBot SDK utility: done
module ZefoyTiktokBotUtilities
  Done = ->(ctx) {
    if ctx.ctrl.explain
      ctx.ctrl.explain = ctx.utility.clean.call(ctx, ctx.ctrl.explain)
      er = ctx.ctrl.explain["result"]
      er.delete("err") if er.is_a?(Hash)
    end
    if ctx.result && ctx.result.ok
      return ctx.result.resdata
    end
    # On error, make_error raises the exception (or, when throw_err is
    # disabled, returns the bare result data). Propagate its value.
    ctx.utility.make_error.call(ctx, nil)
  }
end
