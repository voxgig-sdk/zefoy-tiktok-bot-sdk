# ProjectName SDK EntityName entity

from utility.voxgig_struct import voxgig_struct as vs
from core import helpers


class EntityNameEntity:

    def __init__(self, client, entopts=None):
        if entopts is None:
            entopts = {}
        if "active" not in entopts:
            entopts["active"] = True
        elif entopts["active"] is False:
            pass  # keep false
        else:
            entopts["active"] = True

        self._name = "entityname"
        self._client = client
        self._utility = client.get_utility()
        self._entopts = entopts
        self._data = {}
        self._match = {}

        self._entctx = self._utility.make_context({
            "entity": self,
            "entopts": entopts,
        }, client.get_root_ctx())

        self._utility.feature_hook(self._entctx, "PostConstructEntity")

    def get_name(self):
        return self._name

    def make(self):
        opts = {}
        for k, v in self._entopts.items():
            opts[k] = v
        return EntityNameEntity(self._client, opts)

    def data_set(self, args=None):
        if args is not None:
            self._data = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetData")

    def data_get(self):
        self._utility.feature_hook(self._entctx, "GetData")
        return vs.clone(self._data)

    def match_set(self, args=None):
        if args is not None:
            self._match = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetMatch")

    def match_get(self):
        self._utility.feature_hook(self._entctx, "GetMatch")
        return vs.clone(self._match)

    # #LoadOp

    # #ListOp

    # #CreateOp

    # #UpdateOp

    # #RemoveOp

    def _run_op(self, ctx, post_done):
        utility = self._utility

        # #PrePoint-Hook

        point, err = utility.make_point(ctx)
        ctx.out["point"] = point
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreSpec-Hook

        spec, err = utility.make_spec(ctx)
        ctx.out["spec"] = spec
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreRequest-Hook

        resp, err = utility.make_request(ctx)
        ctx.out["request"] = resp
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreResponse-Hook

        resp2, err = utility.make_response(ctx)
        ctx.out["response"] = resp2
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreResult-Hook

        result, err = utility.make_result(ctx)
        ctx.out["result"] = result
        if err is not None:
            return utility.make_error(ctx, err)

        # #PreDone-Hook

        post_done()

        return utility.done(ctx)
