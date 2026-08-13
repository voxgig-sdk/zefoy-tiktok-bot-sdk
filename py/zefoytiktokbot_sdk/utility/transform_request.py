# ZefoyTiktokBot SDK utility: transform_request

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs
from zefoytiktokbot_sdk.core.helpers import to_map


def transform_request_util(ctx):
    spec = ctx.spec
    point = ctx.point

    if spec is not None:
        spec.step = "reqform"

    transform = to_map(vs.getprop(point, "transform"))
    if transform is None:
        return ctx.reqdata

    reqform = vs.getprop(transform, "req")
    if reqform is None:
        return ctx.reqdata

    reqdata = vs.transform({
        "reqdata": ctx.reqdata,
    }, reqform)

    return reqdata
