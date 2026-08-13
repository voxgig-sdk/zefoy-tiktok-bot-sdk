# ZefoyTiktokBot SDK utility: prepare_headers

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


def prepare_headers_util(ctx):
    options = ctx.client.options_map()
    headers = vs.getprop(options, "headers")

    if headers is None:
        return {}

    out = vs.clone(headers)
    if isinstance(out, dict):
        return out
    return {}
