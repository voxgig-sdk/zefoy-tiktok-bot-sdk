# ZefoyTiktokBot SDK utility: make_response


def make_response_util(ctx):
    if ctx.out.get("response") is not None:
        return ctx.out["response"], None

    utility = ctx.utility
    spec = ctx.spec
    result = ctx.result
    response = ctx.response

    if spec is None:
        return None, ctx.make_error("response_no_spec",
            "Expected context spec property to be defined.")
    if response is None:
        return None, ctx.make_error("response_no_response",
            "Expected context response property to be defined.")
    if result is None:
        return None, ctx.make_error("response_no_result",
            "Expected context result property to be defined.")

    spec.step = "response"

    utility.result_basic(ctx)
    utility.result_headers(ctx)
    utility.result_body(ctx)
    utility.transform_response(ctx)

    if result.err is None:
        result.ok = True

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["result"] = result

    return response, None
