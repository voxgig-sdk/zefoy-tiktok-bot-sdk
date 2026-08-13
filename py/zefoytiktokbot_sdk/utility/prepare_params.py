# ZefoyTiktokBot SDK utility: prepare_params

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


def prepare_params_util(ctx):
    utility = ctx.utility
    point = ctx.point

    params = []
    if point is not None:
        args = vs.getprop(point, "args")
        if isinstance(args, dict):
            p = vs.getprop(args, "params")
            if isinstance(p, list):
                params = p

    out = {}
    for pd in params:
        val = utility.param(ctx, pd)
        if val is not None:
            if isinstance(pd, dict):
                name = vs.getprop(pd, "name")
                if isinstance(name, str) and name != "":
                    out[name] = val

    return out
