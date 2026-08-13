# ZefoyTiktokBot SDK utility: feature_init

from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


def feature_init_util(ctx, f):
    fname = f.get_name()
    fopts = {}

    if ctx.options is not None:
        feature_opts = vs.getprop(ctx.options, "feature")
        if isinstance(feature_opts, dict):
            fo = vs.getprop(feature_opts, fname)
            if isinstance(fo, dict):
                fopts = fo

    if fopts.get("active") is True:
        f.init(ctx, fopts)
