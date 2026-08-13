# ZefoyTiktokBot SDK utility: make_options

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs


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

    # Feature add-order. options["feature"] may be given as an ordered LIST of
    # {name, active, ...opts} entries (the list position IS the order in which
    # features are added), or as a {name: {opts}} map. Normalize a list to a
    # map (so merge/validate/init are unchanged) and remember the explicit
    # order; a map defaults to test-first so the `test` mock transport is
    # installed as the base of the transport wrapper chain.
    featureorder = []
    if isinstance(opts.get("feature"), list):
        fmap = {}
        for entry in opts["feature"]:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if name is None:
                continue
            fopts = {k: v for k, v in entry.items() if k != "name"}
            fmap[name] = fopts
            featureorder.append(name)
        opts["feature"] = fmap

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
            "op": "create,update,load,list,remove,command,direct,graphql",
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
        # Server-variable values for a templated base URL (OpenAPI server
        # variables): {name} placeholders in "base" are substituted from this
        # map at construction. Spec defaults arrive via the generated config;
        # user values override them.
        "server": {
            "`$CHILD`": "",
        },
    }

    # Preserve system.fetch before merge/validate.
    sys_fetch = vs.getpath(opts, "system.fetch")

    merged = vs.merge([{}, cfgopts, opts])
    validated = vs.validate(merged, optspec)
    if not isinstance(validated, dict):
        validated = {}
    opts = validated

    # Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
    # Every placeholder must resolve to a non-empty value: from
    # options["server"] (user), else the config default. A placeholder that
    # resolves to "" is a construction ERROR in live mode — the URL cannot
    # work — but in test mode substitutes the deterministic value
    # "test-<name>" so offline tests need no configuration.
    base = opts.get("base")
    if isinstance(base, str) and "{" in base:
        import re as _re
        testmode = (
            vs.getpath(opts, "test.active") is True
            or vs.getpath(opts, "feature.test.active") is True
        )
        server = opts.get("server") if isinstance(opts.get("server"), dict) else {}
        sdkname = "SDK"
        if isinstance(config, dict):
            mn = vs.getpath(config, "main.name")
            if isinstance(mn, str) and mn != "":
                sdkname = mn

        def _sub(m):
            name = m.group(1)
            val = server.get(name)
            val = val if isinstance(val, str) else ""
            if val == "":
                if testmode:
                    return "test-" + name
                raise ValueError(
                    sdkname + ": the server variable '" + name + "' is required: "
                    "the API base URL is '" + base + "' — pass "
                    '{"server": {"' + name + '": "..."}} in the SDK options')
            return val

        opts["base"] = _re.sub(r"\{([A-Za-z0-9_]+)\}", _sub, base)

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

    # Resolve the feature add-order: an explicit list order (above) wins;
    # otherwise order the map test-first, then the remaining names sorted, so
    # the outcome is deterministic and `test` is always the base transport.
    if len(featureorder) == 0:
        fmap = opts.get("feature")
        names = sorted(fmap.keys()) if isinstance(fmap, dict) else []
        if "test" in names:
            featureorder = ["test"] + [n for n in names if n != "test"]
        else:
            featureorder = names

    derived = {"clean": {}}
    if keyre != "":
        derived["clean"] = {"keyre": keyre}
    derived["featureorder"] = featureorder
    opts["__derived__"] = derived

    return opts
