# ZefoyTiktokBot SDK utility: done
module ZefoyTiktokBotUtilities
  Done = ->(ctx) {
    if ctx.ctrl.explain
      ctx.ctrl.explain = ctx.utility.clean.call(ctx, ctx.ctrl.explain)
      er = ctx.ctrl.explain["result"]
      er.delete("err") if er.is_a?(Hash)
    end
    if ctx.result && ctx.result.ok
      return ctx.result.resdata, nil
    end
    ctx.utility.make_error.call(ctx, nil)
  }
end
