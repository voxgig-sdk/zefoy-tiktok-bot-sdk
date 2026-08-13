# ZefoyTiktokBot SDK utility: feature_add


def feature_add_util(ctx, f):
    client = ctx.client
    features = client.features

    # Features can position themselves relative to an already-added feature
    # via `_options` ("__before__" / "__after__" / "__replace__"), set by
    # the caller on `extend` feature instances — mirrors the ts featureAdd.
    # The first match wins; with no match the feature is appended.
    fopts = getattr(f, "_options", None) or {}
    before = fopts.get("__before__")
    after = fopts.get("__after__")
    replace = fopts.get("__replace__")

    if before or after or replace:
        for i, ef in enumerate(features):
            name = getattr(ef, "name", None)
            if before == name:
                features.insert(i, f)
                return
            if after == name:
                features.insert(i + 1, f)
                return
            if replace == name:
                features[i] = f
                return

    features.append(f)
