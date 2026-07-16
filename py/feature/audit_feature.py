# ZefoyTiktokBot SDK audit feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Audit trail. Emits a structured record for every operation — who (actor),
# what (entity + op), the outcome, and a correlation id — suitable for
# compliance logging. Records accumulate on `client._audit["records"]`
# (bounded by `max`, default 1000) and, when a `sink` callback is supplied,
# are also pushed to it (e.g. to forward to a SIEM). The actor is taken
# from a per-call `ctrl` actor, then options (`actor`), then 'anonymous'.
# Timestamps use the injectable `now` clock so tests stay deterministic.
class ZefoyTiktokBotAuditFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "audit"
        self.active = True
        self.client = None
        self.options = {}
        self.seq = 0

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        self.seq = 0

        client = self.client
        if getattr(client, "_audit", None) is None:
            client._audit = {"records": []}

    def PreDone(self, ctx):
        if not self.active:
            return
        # Outcome reflects the actual result; a non-2xx reaches PreDone
        # before the pipeline raises.
        result = ctx.result
        ok = result is not None and result.ok is not False and result.err is None
        self._emit(ctx, "ok" if ok else "error")

    def PreUnexpected(self, ctx):
        if not self.active:
            return
        self._emit(ctx, "error")

    def _emit(self, ctx, outcome):
        # One record per operation (PreDone + a following PreUnexpected on a
        # non-2xx must not double-log).
        if getattr(ctx, "_audit_seen", False):
            return
        ctx._audit_seen = True

        self.seq += 1

        actor = getattr(ctx.ctrl, "actor", None) if ctx.ctrl is not None else None
        if actor is None:
            actor = self.options.get("actor")
        if actor is None:
            actor = "anonymous"

        record = {
            "seq": self.seq,
            "ts": self._now(),
            "actor": actor,
            "entity": (ctx.op.entity if ctx.op is not None else None) or "_",
            "op": (ctx.op.name if ctx.op is not None else None) or "_",
            "outcome": outcome,
            "status": ctx.result.status if ctx.result is not None else None,
            "correlationId": ctx.id,
        }

        records = self.client._audit["records"]
        records.append(record)
        mx = 1000 if self.options.get("max") is None else self.options.get("max")
        while len(records) > mx:
            records.pop(0)

        sink = self.options.get("sink")
        if callable(sink):
            try:
                sink(record)
            except Exception:
                pass

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000
