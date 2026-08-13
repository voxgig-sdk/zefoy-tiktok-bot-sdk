# ZefoyTiktokBot SDK utility: transform_response

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.helpers import to_map


def transform_response_util(ctx):
    spec = ctx.spec
    result = ctx.result
    point = ctx.point

    if spec is not None:
        spec.step = "resform"

    if result is None or not result.ok:
        return None

    transform = to_map(vs.getprop(point, "transform"))
    if transform is None:
        return None

    resform = vs.getprop(transform, "res")
    if resform is None:
        return None

    resdata = vs.transform({
        "ok": result.ok,
        "status": result.status,
        "statusText": result.status_text,
        "headers": result.headers,
        "body": result.body,
        "err": result.err,
        "resdata": result.resdata,
        "resmatch": result.resmatch,
    }, resform)

    result.resdata = resdata
    return resdata
