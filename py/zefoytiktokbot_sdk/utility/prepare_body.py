# ZefoyTiktokBot SDK utility: prepare_body


def prepare_body_util(ctx):
    op = ctx.op

    if op.input == "data":
        body = ctx.utility.transform_request(ctx)
        return body

    return None
