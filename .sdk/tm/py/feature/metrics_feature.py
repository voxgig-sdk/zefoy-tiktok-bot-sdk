# ZefoyTiktokBot SDK metrics feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Statistics capture. Records per-operation counters and latency for every
# call: totals plus a breakdown keyed by `<entity>.<op>`. Timing starts at
# endpoint resolution (PrePoint) and stops when the call returns (PreDone)
# or fails (PreUnexpected). Aggregates live on `client._metrics`. The clock
# is injectable (`now`) for deterministic tests.
class ZefoyTiktokBotMetricsFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "metrics"
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

        client = self.client
        if getattr(client, "_metrics", None) is None:
            client._metrics = {
                "total": {"count": 0, "ok": 0, "err": 0, "totalMs": 0, "maxMs": 0},
                "ops": {},
            }

    def PrePoint(self, ctx):
        if not self.active:
            return
        ctx._metrics_start = self._now()

    def PreDone(self, ctx):
        if not self.active:
            return
        # Classify by the actual result: a 4xx/5xx that flows through still
        # reaches PreDone before the pipeline raises.
        result = ctx.result
        ok = result is not None and result.ok is not False and result.err is None
        self._record(ctx, ok)

    def PreUnexpected(self, ctx):
        if not self.active:
            return
        self._record(ctx, False)

    def _record(self, ctx, ok):
        # Record once per operation. When a non-2xx result reaches PreDone
        # the pipeline then raises, firing PreUnexpected too; the missing
        # start marker makes the second call a no-op.
        start = getattr(ctx, "_metrics_start", None)
        if start is None:
            return
        del ctx._metrics_start

        dur = max(0, self._now() - start)

        metrics = self.client._metrics
        key = "_"
        if ctx.op is not None:
            key = (ctx.op.entity or "_") + "." + (ctx.op.name or "_")

        op_bucket = metrics["ops"].get(key)
        if op_bucket is None:
            op_bucket = {"count": 0, "ok": 0, "err": 0, "totalMs": 0, "maxMs": 0}
            metrics["ops"][key] = op_bucket

        self._bump(metrics["total"], ok, dur)
        self._bump(op_bucket, ok, dur)

    def _bump(self, bucket, ok, dur):
        bucket["count"] += 1
        bucket["ok" if ok else "err"] += 1
        bucket["totalMs"] += dur
        if dur > bucket["maxMs"]:
            bucket["maxMs"] = dur

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000
