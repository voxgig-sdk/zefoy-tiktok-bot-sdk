# ZefoyTiktokBot SDK utility: prepare_query

from __future__ import annotations
from utility.voxgig_struct import voxgig_struct as vs


def _contains_param(params, s):
    for v in params:
        if isinstance(v, str) and v == s:
            return True
    return False


def prepare_query_util(ctx):
    point = ctx.point
    reqmatch = ctx.reqmatch or {}

    params = []
    if point is not None:
        p = vs.getprop(point, "params")
        if isinstance(p, list):
            params = p

    out = {}
    reqmatch_items = vs.items(reqmatch)
    if reqmatch_items is not None:
        for item in reqmatch_items:
            key = item[0]
            val = item[1]
            if val is not None and isinstance(key, str) and not _contains_param(params, key):
                out[key] = val

    return out
