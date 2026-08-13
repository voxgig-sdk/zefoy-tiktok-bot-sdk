# ZefoyTiktokBot SDK utility: feature_hook


def feature_hook_util(ctx, name):
    client = ctx.client
    if client is None:
        return
    features = client.features
    if features is None:
        return

    for f in features:
        method = getattr(f, name, None)
        if callable(method):
            method(ctx)
