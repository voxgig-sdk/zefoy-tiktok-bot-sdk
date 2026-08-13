# ZefoyTiktokBot SDK utility: param

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs
from zefoytiktokbot_sdk.core.helpers import to_map


def param_util(ctx, paramdef):
    point = ctx.point
    spec = ctx.spec
    match = ctx.match
    reqmatch = ctx.reqmatch
    data = ctx.data
    reqdata = ctx.reqdata

    pt = vs.typify(paramdef)
    key = ""

    if (vs.T_string & pt) > 0:
        key = paramdef
    else:
        k = vs.getprop(paramdef, "name")
        if isinstance(k, str):
            key = k

    akey = ""
    if point is not None:
        alias = to_map(vs.getprop(point, "alias"))
        if alias is not None:
            ak = vs.getprop(alias, key)
            if isinstance(ak, str):
                akey = ak

    val = vs.getprop(reqmatch, key)

    if val is None:
        val = vs.getprop(match, key)

    if val is None and akey != "":
        if spec is not None:
            spec.alias[akey] = key
        val = vs.getprop(reqmatch, akey)

    if val is None:
        val = vs.getprop(reqdata, key)

    if val is None:
        val = vs.getprop(data, key)

    if val is None and akey != "":
        val = vs.getprop(reqdata, akey)
        if val is None:
            val = vs.getprop(data, akey)

    return val
