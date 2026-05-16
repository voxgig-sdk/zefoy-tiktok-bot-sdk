# ZefoyTiktokBot SDK utility: feature_add


def feature_add_util(ctx, f):
    client = ctx.client
    client.features.append(f)
