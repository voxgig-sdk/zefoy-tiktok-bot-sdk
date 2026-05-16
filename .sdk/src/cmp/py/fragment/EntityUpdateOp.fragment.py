from utility.voxgig_struct import voxgig_struct as vs
from core import helpers

entity_update_op = None

# EJECT-START

    def update(self, reqdata, ctrl=None):
        utility = self._utility
        ctx = utility.make_context({
            "opname": "update",
            "ctrl": ctrl,
            "match": self._match,
            "data": self._data,
            "reqdata": reqdata,
        }, self._entctx)

        def post_done():
            if ctx.result is not None:
                if ctx.result.resmatch is not None:
                    self._match = ctx.result.resmatch
                if ctx.result.resdata is not None:
                    self._data = helpers.to_map(vs.clone(ctx.result.resdata)) or {}

        return self._run_op(ctx, post_done)

# EJECT-END
