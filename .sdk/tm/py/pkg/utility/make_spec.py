# ZefoyTiktokBot SDK utility: make_spec

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.spec import ZefoyTiktokBotSpec
from projectname_sdk.utility.graphql import GRAPHQL_CONTENT_TYPE


def make_spec_util(ctx):
    pre = ctx.out.get("spec")
    if pre is not None:
        # A feature hook may short-circuit with an error (see make_point).
        if isinstance(pre, Exception):
            return None, pre
        ctx.spec = pre
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

    if "graphql" == vs.getprop(point, "kind"):
        # GraphQL addresses one endpoint: no path parts, no query string,
        # and the body carries the operation. prepare_body is skipped
        # deliberately — it only emits a body for data-input ops, whereas
        # every GraphQL op posts one, including load/list/remove.
        ctx.spec.body = utility.graphql_body(ctx)
        ctx.spec.path = ""
        # prepare_query already copied the op's match arguments into the
        # query string. Those same values are bound as operation
        # variables, so leaving them would send /graphql?id=i1.
        ctx.spec.query = {}
        ctx.spec.headers["content-type"] = GRAPHQL_CONTENT_TYPE
    else:
        ctx.spec.body = utility.prepare_body(ctx)
        ctx.spec.path = utility.prepare_path(ctx)

    if ctx.ctrl.explain is not None:
        ctx.ctrl.explain["spec"] = ctx.spec

    spec, err = utility.prepare_auth(ctx)
    if err is not None:
        return None, err

    ctx.spec = spec
    return spec, None
