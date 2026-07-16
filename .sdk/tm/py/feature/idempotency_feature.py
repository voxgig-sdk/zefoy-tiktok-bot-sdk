# ZefoyTiktokBot SDK idempotency feature

from __future__ import annotations
import random

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Idempotency keys for mutating operations. Adds an `Idempotency-Key`
# header (name configurable via `header`) to unsafe requests so a server
# can de-duplicate retried writes. The key is set once, at PreRequest,
# before the request is built — so it is stable across transport-level
# retries of the same call. A caller-supplied header is never overwritten
# (case-insensitive). The key generator (`keygen`) is injectable for
# deterministic tests.
class ZefoyTiktokBotIdempotencyFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "idempotency"
        self.active = True
        self.client = None
        self.options = {}

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

    def PreRequest(self, ctx):
        if not self.active:
            return

        spec = ctx.spec
        if spec is None:
            return

        if not self._mutating(ctx):
            return

        header = self.options.get("header") or "Idempotency-Key"
        if spec.headers is None:
            spec.headers = {}

        # Respect a key the caller already provided.
        if self._existing(spec.headers, header) is not None:
            return

        key = self._genkey()
        spec.headers[header] = key

        client = self.client
        track = getattr(client, "_idempotency", None)
        if track is None:
            track = {"issued": 0, "last": None}
            client._idempotency = track
        track["issued"] += 1
        track["last"] = key

    def _mutating(self, ctx):
        methods = self.options.get("methods") or ["POST", "PUT", "PATCH", "DELETE"]
        method = ""
        if ctx.spec is not None and ctx.spec.method is not None:
            method = str(ctx.spec.method).upper()
        if method != "" and method in methods:
            return True
        opname = ctx.op.name if ctx.op is not None else None
        ops = self.options.get("ops") or ["create", "update", "remove"]
        return opname in ops

    def _existing(self, headers, header):
        lower = header.lower()
        for key in headers:
            if str(key).lower() == lower:
                return headers[key]
        return None

    def _genkey(self):
        keygen = self.options.get("keygen")
        if callable(keygen):
            return keygen()
        return "%04x%04x%04x%04x%04x%04x" % (
            random.randint(0, 0xFFFF), random.randint(0, 0xFFFF),
            random.randint(0, 0xFFFF), random.randint(0, 0xFFFF),
            random.randint(0, 0xFFFF), random.randint(0, 0xFFFF))
