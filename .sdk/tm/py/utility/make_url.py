# ZefoyTiktokBot SDK utility: make_url

from __future__ import annotations
from utility.voxgig_struct import voxgig_struct as vs


def make_url_util(ctx):
    spec = ctx.spec
    result = ctx.result

    if spec is None:
        return "", ctx.make_error("url_no_spec",
            "Expected context spec property to be defined.")
    if result is None:
        return "", ctx.make_error("url_no_result",
            "Expected context result property to be defined.")

    url = vs.join([spec.base, spec.prefix, spec.path, spec.suffix], "/", True)
    resmatch = {}

    param_items = vs.items(spec.params)
    if param_items is not None:
        for item in param_items:
            key = item[0]
            val = item[1]
            if val is not None and isinstance(key, str):
                val_str = val if isinstance(val, str) else str(val)
                encoded = vs.escurl(val_str)
                url = url.replace("{" + key + "}", encoded)
                resmatch[key] = val

    # Append query string from spec.query.
    qsep = "?"
    query_items = vs.items(getattr(spec, "query", None))
    if query_items is not None:
        for item in query_items:
            key = item[0]
            val = item[1]
            if val is not None and isinstance(key, str):
                val_str = val if isinstance(val, str) else str(val)
                url += qsep + vs.escurl(key) + "=" + vs.escurl(val_str)
                qsep = "&"
                resmatch[key] = val

    result.resmatch = resmatch

    return url, None
