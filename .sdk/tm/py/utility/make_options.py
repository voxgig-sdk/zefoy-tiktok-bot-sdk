# ZefoyTiktokBot SDK utility: make_options

from __future__ import annotations
from utility.voxgig_struct import voxgig_struct as vs


def make_options_util(ctx):
    options = ctx.options or {}

    # Merge custom utility overrides.
    custom_utils = vs.getprop(options, "utility")
    if isinstance(custom_utils, dict):
        utility = ctx.utility
        if utility is not None:
            for key, val in custom_utils.items():
                utility.custom[key] = val

    opts = vs.clone(options)
    if not isinstance(opts, dict):
        opts = {}

    config = ctx.config or {}
    cfgopts = {}
    co = config.get("options") if isinstance(config, dict) else None
    if isinstance(co, dict):
        cfgopts = co

    optspec = {
        "apikey": "",
        "base": "http://localhost:8000",
        "prefix": "",
        "suffix": "",
        "auth": {
            "prefix": "",
        },
        "headers": {
            "`$CHILD`": "`$STRING`",
        },
        "allow": {
            "method": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
            "op": "create,update,load,list,remove,command,direct",
        },
        "entity": {
            "`$CHILD`": {
                "`$OPEN`": True,
                "active": False,
                "alias": {},
            },
        },
        "feature": {
            "`$CHILD`": {
                "`$OPEN`": True,
                "active": False,
            },
        },
        "utility": {},
        "system": {},
        "test": {
            "active": False,
            "entity": {
                "`$OPEN`": True,
            },
        },
        "clean": {
            "keys": "key,token,id",
        },
    }

    # Preserve system.fetch before merge/validate.
    sys_fetch = vs.getpath(opts, "system.fetch")

    merged = vs.merge([{}, cfgopts, opts])
    validated = vs.validate(merged, optspec)
    if not isinstance(validated, dict):
        validated = {}
    opts = validated

    # Restore system.fetch.
    if sys_fetch is not None:
        if isinstance(opts.get("system"), dict):
            opts["system"]["fetch"] = sys_fetch
        else:
            opts["system"] = {"fetch": sys_fetch}

    # Derived clean config.
    clean_keys = "key,token,id"
    ck = vs.getpath(opts, "clean.keys")
    if isinstance(ck, str):
        clean_keys = ck

    parts = []
    for part in clean_keys.split(","):
        trimmed = part.strip()
        if trimmed != "":
            parts.append(vs.escre(trimmed))
    keyre = "|".join(parts)

    derived = {"clean": {}}
    if keyre != "":
        derived["clean"] = {"keyre": keyre}
    opts["__derived__"] = derived

    return opts
