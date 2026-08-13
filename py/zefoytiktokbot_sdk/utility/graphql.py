# ZefoyTiktokBot SDK utility: graphql

# GraphQL transport. API-INDEPENDENT: every GraphQL SDK this generator
# produces uses this file unchanged. The API-specific part — which
# operations exist and what each one's document is — is model data,
# computed once by apidef and emitted into Config.
#
# Two jobs:
#
#   graphql_body   — build { query, variables } for a point, binding the
#                    op's arguments to the document's declared variables.
#
#   graphql_errors — lift a GraphQL failure into an SDK error. GraphQL
#                    reports failures as a top-level `errors` array under
#                    HTTP 200, so the status-driven path in result_basic
#                    never sees them.

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


# Content type every GraphQL-over-HTTP request uses.
GRAPHQL_CONTENT_TYPE = "application/json"


def graphql_error_code(gqlerr):
    """Map a GraphQL error to the same error codes the HTTP path produces,
    so a caller handles auth or rate limiting identically on both
    transports. Servers put the machine-readable code in
    `extensions.code`; Linear-style APIs use `extensions.type`."""
    ext = vs.getprop(gqlerr, "extensions") or {}

    raw = vs.getprop(ext, "code") or vs.getprop(ext, "type") or ""
    raw = str(raw).upper()

    if "AUTH" in raw or "FORBIDDEN" in raw or "UNAUTHENTICATED" in raw:
        return "request_auth"
    if "RATELIMIT" in raw or "RATE_LIMIT" in raw or "TOO_MANY" in raw:
        return "request_ratelimit"
    if "BAD_USER_INPUT" in raw or "VALIDATION" in raw or "INVALID" in raw:
        return "request_invalid"

    return "request_graphql"


def graphql_body_util(ctx):
    """Build the request body for a GraphQL point.

    Variables come from the op's own arguments: a named variable binds to
    the like-named argument (`from`), and the input-object variable (empty
    `from`) takes the request data as a whole — which is what makes a
    generated create/update call look exactly like its REST equivalent."""
    point = ctx.point
    gql = vs.getprop(point, "graphql")

    if not isinstance(gql, dict):
        return None

    # reqmatch/reqdata hold the caller's arguments for THIS call; data/match
    # hold the entity's current state. Which pair depends on whether the op
    # takes match or data input. A named variable falls back to the current
    # state, so updating a loaded entity with just {title} still binds the
    # stored id the mutation requires.
    reqsrc, datasrc = ctx.reqmatch, ctx.match
    if ctx.op is not None and getattr(ctx.op, "input", "match") == "data":
        reqsrc, datasrc = ctx.reqdata, ctx.data
    if not isinstance(reqsrc, dict):
        reqsrc = {}
    if not isinstance(datasrc, dict):
        datasrc = {}

    variables = {}

    varlist = vs.getprop(gql, "vars")
    if not isinstance(varlist, list):
        varlist = []

    for spec in varlist:
        if not isinstance(spec, dict):
            continue

        name = vs.getprop(spec, "name")
        frm = vs.getprop(spec, "from")

        if frm is None or frm == "":
            # The input object IS the request body. Strip the action
            # selector, which is an SDK-side point discriminator, not an
            # API field.
            variables[name] = {
                k: v for k, v in reqsrc.items() if k != "$action"
            }
            continue

        # Only send variables the caller actually supplied: sending an
        # explicit null would clear a field on many APIs.
        val = vs.getprop(reqsrc, frm)
        if val is None:
            val = vs.getprop(datasrc, frm)
        if val is not None:
            variables[name] = val

    return {
        "query": vs.getprop(gql, "doc"),
        "variables": variables,
    }


def graphql_errors_util(ctx):
    """Inspect a decoded GraphQL response body and record a failure when
    the server reported one. Returns True when an error was recorded.

    Partial data (`data` alongside `errors`) is treated as failure: the
    REST surface has no partial-success concept, and silently returning
    half an object would be worse than failing. The raw envelope stays
    available on the result for callers that need it."""
    result = ctx.result
    point = ctx.point

    if result is None or point is None:
        return False

    if vs.getprop(point, "kind") != "graphql":
        return False

    errors = vs.getprop(result.body, "errors")
    if not isinstance(errors, list) or 0 == len(errors):
        return False

    first = errors[0]
    msg = vs.getprop(first, "message") or "graphql error"
    if 1 < len(errors):
        msg = msg + " (+" + str(len(errors) - 1) + " more)"

    err = ctx.make_error(graphql_error_code(first), "graphql: " + msg)

    # Keep the full error list reachable for diagnostics.
    try:
        err.graphql = errors
    except Exception:
        pass

    result.err = err
    result.ok = False

    return True
