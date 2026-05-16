# ZefoyTiktokBot SDK utility: result_body


def result_body_util(ctx):
    response = ctx.response
    result = ctx.result

    if result is not None:
        if response is not None and response.json_func is not None and response.body is not None:
            json_data = response.json_func()
            result.body = json_data

    return result
