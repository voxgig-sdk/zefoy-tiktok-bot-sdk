entity_list_op = None

# EJECT-START

    def list(self, reqmatch, ctrl=None):
        utility = self._utility
        ctx = utility.make_context({
            "opname": "list",
            "ctrl": ctrl,
            "match": self._match,
            "data": self._data,
            "reqmatch": reqmatch,
        }, self._entctx)

        def post_done():
            if ctx.result is not None:
                if ctx.result.resmatch is not None:
                    self._match = ctx.result.resmatch

        return self._run_op(ctx, post_done)

# EJECT-END
