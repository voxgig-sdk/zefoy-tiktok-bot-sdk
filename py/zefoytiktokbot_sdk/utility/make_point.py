# ZefoyTiktokBot SDK utility: make_point

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs
from zefoytiktokbot_sdk.core.helpers import to_map


def make_point_util(ctx):
    pre = ctx.out.get("point")
    if pre is not None:
        # A feature hook (e.g. rbac) short-circuits endpoint resolution by
        # placing an error in ctx.out["point"] (mirrors the ts pipeline
        # where `ctx.out.point instanceof Error` aborts the operation).
        if isinstance(pre, Exception):
            return None, pre
        ctx.point = pre
        return ctx.point, None

    op = ctx.op
    options = ctx.options

    allow_op = vs.getpath(options, "allow.op") or ""
    if isinstance(allow_op, str) and op.name not in allow_op:
        return None, ctx.make_error("point_op_allow",
            'Operation "' + op.name +
            '" not allowed by SDK option allow.op value: "' + allow_op + '"')

    if len(op.points) == 0:
        return None, ctx.make_error("point_no_points",
            'Operation "' + op.name + '" has no endpoint definitions.')

    if len(op.points) == 1:
        ctx.point = op.points[0]
    else:
        if op.input == "data":
            reqselector = ctx.reqdata
            selector = ctx.data
        else:
            reqselector = ctx.reqmatch
            selector = ctx.match

        point = None
        for i in range(len(op.points)):
            point = op.points[i]
            select_def = to_map(vs.getprop(point, "select"))
            found = True

            if selector is not None and select_def is not None:
                exist = vs.getprop(select_def, "exist")
                if isinstance(exist, list):
                    for ek in exist:
                        existkey = str(ek)
                        rv = vs.getprop(reqselector, existkey)
                        sv = vs.getprop(selector, existkey)
                        if rv is None and sv is None:
                            found = False
                            break

            if found:
                req_action = vs.getprop(reqselector, "$action")
                select_action = vs.getprop(select_def, "$action")
                if req_action != select_action:
                    found = False

            if found:
                break

        if reqselector is not None:
            req_action = vs.getprop(reqselector, "$action")
            if req_action is not None and point is not None:
                point_select = to_map(vs.getprop(point, "select"))
                point_action = vs.getprop(point_select, "$action")
                if req_action != point_action:
                    return None, ctx.make_error("point_action_invalid",
                        'Operation "' + op.name +
                        '" action "' + vs.stringify(req_action) + '" is not valid.')

        ctx.point = point

    return ctx.point, None
