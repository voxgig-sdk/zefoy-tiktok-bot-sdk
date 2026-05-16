# ZefoyTiktokBot SDK utility: done


def done_util(ctx):
    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain = ctx.utility.clean(ctx, ctx.ctrl.explain)
        explain_result = ctx.ctrl.explain.get("result") if isinstance(ctx.ctrl.explain, dict) else None
        if isinstance(explain_result, dict):
            explain_result.pop("err", None)

    if ctx.result is not None and ctx.result.ok:
        return ctx.result.resdata, None

    return ctx.utility.make_error(ctx, None)
