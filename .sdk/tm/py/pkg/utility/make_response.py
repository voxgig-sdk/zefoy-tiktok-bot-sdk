# ZefoyTiktokBot SDK utility: make_response


def make_response_util(ctx):
    pre = ctx.out.get("response")
    if pre is not None:
        # A feature hook may short-circuit with an error (see make_point).
        if isinstance(pre, Exception):
            return None, pre
        return pre, None

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

    # GraphQL reports failures as a top-level `errors` array under HTTP
    # 200, so result_basic's status check never sees them. Lift them here,
    # before the response transform tries to unwrap data that is not there.
    utility.graphql_errors(ctx)

    utility.transform_response(ctx)

    if result.err is None:
        result.ok = True

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["result"] = result

    return response, None
