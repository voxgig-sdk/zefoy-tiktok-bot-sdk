# ZefoyTiktokBot SDK utility: prepare_path

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


def prepare_path_util(ctx):
    point = ctx.point

    parts = []
    if point is not None:
        p = vs.getprop(point, "parts")
        if isinstance(p, list):
            parts = p

    return vs.join(parts, "/", True)
