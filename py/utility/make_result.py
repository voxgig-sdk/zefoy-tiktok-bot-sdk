# ZefoyTiktokBot SDK utility: make_result


def make_result_util(ctx):
    pre = ctx.out.get("result")
    if pre is not None:
        # A feature hook may short-circuit with an error (see make_point).
        if isinstance(pre, Exception):
            return None, pre
        return pre, None

    utility = ctx.utility
    op = ctx.op
    entity = ctx.entity
    spec = ctx.spec
    result = ctx.result

    if spec is None:
        return None, ctx.make_error("result_no_spec",
            "Expected context spec property to be defined.")
    if result is None:
        return None, ctx.make_error("result_no_result",
            "Expected context result property to be defined.")

    spec.step = "result"

    utility.transform_response(ctx)

    if op.name == "list":
        resdata = result.resdata
        result.resdata = []

        if resdata is not None and isinstance(resdata, list) and entity is not None:
            entities = []
            for entry in resdata:
                ent = entity.make()
                if isinstance(entry, dict):
                    ent.data_set(entry)
                entities.append(ent)
            result.resdata = entities

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["result"] = result

    return result, None
