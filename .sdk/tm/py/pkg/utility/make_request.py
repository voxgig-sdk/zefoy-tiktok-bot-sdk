# ZefoyTiktokBot SDK utility: make_request

from __future__ import annotations
from projectname_sdk.core.response import ZefoyTiktokBotResponse
from projectname_sdk.core.result import ZefoyTiktokBotResult


def make_request_util(ctx):
    pre = ctx.out.get("request")
    if pre is not None:
        # A feature hook may short-circuit with an error (see make_point).
        if isinstance(pre, Exception):
            return None, pre
        return pre, None

    spec = ctx.spec
    utility = ctx.utility

    response = ZefoyTiktokBotResponse({})
    result = ZefoyTiktokBotResult({})
    ctx.result = result

    if spec is None:
        return None, ctx.make_error("request_no_spec",
            "Expected context spec property to be defined.")

    fetchdef, err = utility.make_fetch_def(ctx)
    if err is not None:
        response.err = err
        ctx.response = response
        spec.step = "postrequest"
        return response, None

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["fetchdef"] = fetchdef

    spec.step = "prerequest"

    url = fetchdef.get("url", "")
    fetched, fetch_err = utility.fetcher(ctx, url, fetchdef)

    if fetch_err is not None:
        response.err = fetch_err
    elif fetched is None:
        response = ZefoyTiktokBotResponse({
            "err": ctx.make_error("request_no_response", "response: undefined"),
        })
    elif isinstance(fetched, dict):
        response = ZefoyTiktokBotResponse(fetched)
    else:
        response.err = ctx.make_error("request_invalid_response", "response: invalid type")

    spec.step = "postrequest"
    ctx.response = response

    return response, None
