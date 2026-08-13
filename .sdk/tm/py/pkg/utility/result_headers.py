# ZefoyTiktokBot SDK utility: result_headers


def result_headers_util(ctx):
    response = ctx.response
    result = ctx.result

    if result is not None:
        if response is not None and response.headers is not None:
            if isinstance(response.headers, dict):
                result.headers = response.headers
            else:
                result.headers = {}
        else:
            result.headers = {}

    return result
