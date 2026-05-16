# ZefoyTiktokBot SDK utility: prepare_method

METHOD_MAP = {
    "create": "POST",
    "update": "PUT",
    "load": "GET",
    "list": "GET",
    "remove": "DELETE",
    "patch": "PATCH",
}


def prepare_method_util(ctx):
    opname = ctx.op.name
    return METHOD_MAP.get(opname, "GET")
