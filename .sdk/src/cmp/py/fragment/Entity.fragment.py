# ProjectName SDK EntityName entity

from __future__ import annotations

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core import helpers
# #TypeImports


class EntyClass:

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
        self._deleted = False
        self._match = {}

        self._entctx = self._utility.make_context({
            "entity": self,
            "entopts": entopts,
        }, client.get_root_ctx())

        self._utility.feature_hook(self._entctx, "PostConstructEntity")

    def get_name(self):
        return self._name

    # Every operation resolves to the entity; `remove` additionally marks
    # it. The instance KEEPS the data it held — a caller can still read what
    # was deleted — but it is no longer a live record. See AGENTS.md.
    def mark_deleted(self):
        self._deleted = True

    def deleted(self):
        return True is self._deleted


    def make(self):
        opts = {}
        for k, v in self._entopts.items():
            opts[k] = v
        return EntyClass(self._client, opts)

    def data_set(self, args=None):
        if args is not None:
            self._data = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetData")

    def data_get(self) -> EntityName:
        self._utility.feature_hook(self._entctx, "GetData")
        return vs.clone(self._data)

    def match_set(self, args=None):
        if args is not None:
            self._match = helpers.to_map(vs.clone(args)) or {}
            self._utility.feature_hook(self._entctx, "SetMatch")

    def match_get(self) -> EntityName:
        self._utility.feature_hook(self._entctx, "GetMatch")
        return vs.clone(self._match)

    def stream(self, action, args=None, callopts=None):
        # Feature #4: run `action` through the full pipeline and yield result
        # items, so the `streaming` feature's incremental output is reachable
        # from a generated entity (a normal op call materialises the whole
        # result). `callopts` parameterises the call:
        #   - inbound (download): yield items/chunks (from the streaming
        #     feature when active, else the materialised items);
        #   - outbound (upload): an iterable `body` in callopts is attached to
        #     the request so the transport can stream the payload;
        #   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.
        utility = self._utility

        if callopts is None:
            callopts = {}
        signal = callopts.get("signal")

        ctrl = dict(callopts.get("ctrl") or {})
        ctrl["stream"] = callopts

        ctxmap = {
            "opname": action,
            "ctrl": ctrl,
            "match": self._match,
            "data": self._data,
        }
        if isinstance(args, dict):
            for k, v in args.items():
                ctxmap[k] = v

        ctx = utility.make_context(ctxmap, self._entctx)

        # Outbound: expose the caller's iterable payload so the request builder
        # / transport can stream it as the request body.
        body = callopts.get("body")
        if body is not None:
            ctx.reqdata = dict(ctx.reqdata or {})
            ctx.reqdata["body$"] = body
            ctx.meta["stream_out"] = body

        def aborted():
            if signal is None:
                return False
            if callable(signal):
                return bool(signal())
            return bool(getattr(signal, "aborted", False))

        utility.feature_hook(ctx, "PrePoint")
        point, err = utility.make_point(ctx)
        ctx.out["point"] = point
        if err is not None:
            return

        utility.feature_hook(ctx, "PreSpec")
        spec, err = utility.make_spec(ctx)
        ctx.out["spec"] = spec
        if err is not None:
            return

        utility.feature_hook(ctx, "PreRequest")
        resp, err = utility.make_request(ctx)
        ctx.out["request"] = resp
        if err is not None:
            return

        utility.feature_hook(ctx, "PreResponse")
        resp2, err = utility.make_response(ctx)
        ctx.out["response"] = resp2
        if err is not None:
            return

        utility.feature_hook(ctx, "PreResult")
        result, err = utility.make_result(ctx)
        ctx.out["result"] = result
        if err is not None:
            return

        utility.feature_hook(ctx, "PreDone")

        result = ctx.result

        # Inbound: prefer the streaming feature's incremental generator; else
        # fall back to the materialised items so stream always yields.
        stream_fn = getattr(result, "stream", None) if result is not None else None
        if callable(stream_fn):
            for item in stream_fn():
                if aborted():
                    return
                yield item
        else:
            data = utility.done(ctx)
            if isinstance(data, list):
                items = data
            elif data is None:
                items = []
            else:
                items = [data]
            for item in items:
                if aborted():
                    return
                yield item

    # #LoadOp

    # #ListOp

    # #CreateOp

    # #UpdateOp

    # #RemoveOp

    def _run_op(self, ctx, post_done):
        utility = self._utility

        try:
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

            out = utility.done(ctx)

    # An operation resolves to the ENTITY, not the raw data. Entities are
    # stateful: post_done has just absorbed resdata/resmatch into this
    # instance, and the caller reaches the record through data(). Two
    # structural exceptions: `list` resolves to the ARRAY of entity
    # instances make_result built, and a failed op with throwing disabled
    # hands back the error payload unchanged. `remove` additionally marks
    # the entity deleted; it KEEPS its data, so a caller can still read
    # what was removed. See AGENTS.md "Entity operations return ENTITIES".
            opname = None if ctx.op is None else ctx.op.name

            if ctx.result is not None and ctx.result.ok and opname != "list":
                if opname == "remove":
                    self.mark_deleted()
                return self

            return out

        except Exception:
            # #PreUnexpected-Hook

            raise
