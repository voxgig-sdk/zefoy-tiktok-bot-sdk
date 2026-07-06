from utility.voxgig_struct import voxgig_struct as vs
from core import helpers

entity_load_op = None

# EJECT-START

    def load(self, reqmatch=None, ctrl=None) -> EntityName:
        utility = self._utility
        # reqmatch is optional: an entity with no id-like key loads with no
        # match. Treat None as an empty match so client.EntityName().load()
        # works with no args.
        if reqmatch is None:
            reqmatch = {}
        ctx = utility.make_context({
            "opname": "load",
            "ctrl": ctrl,
            "match": self._match,
            "data": self._data,
            "reqmatch": reqmatch,
        }, self._entctx)

        def post_done():
            if ctx.result is not None:
                if ctx.result.resmatch is not None:
                    self._match = ctx.result.resmatch
                if ctx.result.resdata is not None:
                    self._data = helpers.to_map(vs.clone(ctx.result.resdata)) or {}

        return self._run_op(ctx, post_done)

# EJECT-END
