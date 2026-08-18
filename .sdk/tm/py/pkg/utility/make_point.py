# ZefoyTiktokBot SDK utility: make_point

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.helpers import to_map


def _parts_len(point):
    parts = vs.getprop(point, "parts")
    return len(parts) if isinstance(parts, list) else 0


def _terminal_param(point):
    # A record route ends in the record's identifier (/boards/{id}); a
    # cross-reference that also returns the entity ends in the
    # relationship's name (/posts/{id}/author).
    parts = vs.getprop(point, "parts")
    if not isinstance(parts, list) or 0 == len(parts):
        return False
    return str(parts[-1]).startswith("{")


def _own_point(points):
    # The entity's OWN route: a terminal parameter first, then the fewest
    # path segments. Ties keep the earlier point, so the model's sorted-key
    # order decides. The same rule runs at generation time, in
    # helpers/opShape.ts — both sides must move together.
    best = points[0]
    for cand in points:
        cand_term = _terminal_param(cand)
        best_term = _terminal_param(best)
        if cand_term != best_term:
            if cand_term:
                best = cand
        elif _parts_len(cand) < _parts_len(best):
            best = cand
    return best


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
        matched = False
        for i in range(len(op.points)):
            cand = op.points[i]
            select_def = to_map(vs.getprop(cand, "select"))
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
                point = cand
                matched = True
                break

        # select.exist can list more than the params needed to pick a point,
        # so nothing matches — fall back to the entity's own route rather
        # than whichever point came last.
        if not matched:
            # A request naming an action reaches here only because that
            # action's own point failed its exist test, so it is unbuildable
            # whatever we pick. Refuse it BEFORE choosing a fallback: the
            # guard below compares the chosen point's $action and would wave
            # the request through whenever the fallback lands on the action
            # point itself.
            req_action = vs.getprop(reqselector, "$action") \
                if reqselector is not None else None
            if req_action is not None:
                return None, ctx.make_error("point_action_invalid",
                    'Operation "' + op.name + '" action "' +
                    vs.stringify(req_action) + '" is not valid.')

            point = _own_point(op.points)

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
