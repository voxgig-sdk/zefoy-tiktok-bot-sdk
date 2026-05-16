# ZefoyTiktokBot SDK utility: result_basic


def result_basic_util(ctx):
    response = ctx.response
    result = ctx.result

    if result is not None and response is not None:
        result.status = response.status
        result.status_text = response.status_text

        if result.status >= 400:
            msg = "request: " + str(result.status) + ": " + result.status_text
            if result.err is not None:
                prevmsg = ""
                if hasattr(result.err, "msg") and result.err.msg is not None:
                    prevmsg = result.err.msg
                else:
                    prevmsg = str(result.err)
                result.err = ctx.make_error("request_status", prevmsg + ": " + msg)
            else:
                result.err = ctx.make_error("request_status", msg)
        elif response.err is not None:
            result.err = response.err

    return result
