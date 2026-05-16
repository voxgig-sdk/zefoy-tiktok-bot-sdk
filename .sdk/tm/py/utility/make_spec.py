# ZefoyTiktokBot SDK utility: make_spec

from __future__ import annotations
from utility.voxgig_struct import voxgig_struct as vs
from core.spec import ZefoyTiktokBotSpec


def make_spec_util(ctx):
    if ctx.out.get("spec") is not None:
        ctx.spec = ctx.out["spec"]
        return ctx.spec, None

    point = ctx.point
    options = ctx.options
    utility = ctx.utility

    base = ""
    b = vs.getprop(options, "base")
    if isinstance(b, str):
        base = b

    prefix = ""
    p = vs.getprop(options, "prefix")
    if isinstance(p, str):
        prefix = p

    suffix = ""
    s = vs.getprop(options, "suffix")
    if isinstance(s, str):
        suffix = s

    parts = []
    if point is not None:
        pt = vs.getprop(point, "parts")
        if isinstance(pt, list):
            parts = pt

    ctx.spec = ZefoyTiktokBotSpec({
        "base": base,
        "prefix": prefix,
        "parts": parts,
        "suffix": suffix,
        "step": "start",
    })

    ctx.spec.method = utility.prepare_method(ctx)

    allow_method = vs.getpath(options, "allow.method") or ""
    if isinstance(allow_method, str) and ctx.spec.method not in allow_method:
        return None, ctx.make_error("spec_method_allow",
            'Method "' + ctx.spec.method +
            '" not allowed by SDK option allow.method value: "' + allow_method + '"')

    ctx.spec.params = utility.prepare_params(ctx)
    ctx.spec.query = utility.prepare_query(ctx)
    ctx.spec.headers = utility.prepare_headers(ctx)
    ctx.spec.body = utility.prepare_body(ctx)
    ctx.spec.path = utility.prepare_path(ctx)

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["spec"] = ctx.spec

    spec, err = utility.prepare_auth(ctx)
    if err is not None:
        return None, err

    ctx.spec = spec
    return spec, None
