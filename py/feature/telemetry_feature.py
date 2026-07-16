# ZefoyTiktokBot SDK telemetry feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Distributed-tracing telemetry. Opens a span per operation (PrePoint),
# propagates trace context to the server as W3C `traceparent` plus
# `X-Trace-Id` / `X-Span-Id` headers (PreRequest), and closes the span on
# completion (PreDone) or failure (PreUnexpected). Finished spans are kept
# on `client._telemetry["spans"]`; an `exporter` callback, when provided,
# is invoked with each finished span. Trace/span id generation (`idgen`)
# and the clock (`now`) are injectable for deterministic tests.
class ZefoyTiktokBotTelemetryFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "telemetry"
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
        if getattr(client, "_telemetry", None) is None:
            client._telemetry = {"spans": [], "active": 0}

    def PrePoint(self, ctx):
        if not self.active:
            return

        entity = "_"
        opname = "_"
        if ctx.op is not None:
            entity = ctx.op.entity or "_"
            opname = ctx.op.name or "_"

        span = {
            "traceId": self._id("trace"),
            "spanId": self._id("span"),
            "name": entity + "." + opname,
            "start": self._now(),
            "end": None,
            "durationMs": None,
            "ok": None,
        }
        ctx._telemetry_span = span
        self.client._telemetry["active"] += 1

    def PreRequest(self, ctx):
        if not self.active:
            return

        span = getattr(ctx, "_telemetry_span", None)
        spec = ctx.spec
        if span is None or spec is None:
            return
        if spec.headers is None:
            spec.headers = {}

        headers = self.options.get("headers") or {}
        spec.headers[headers.get("trace") or "X-Trace-Id"] = span["traceId"]
        spec.headers[headers.get("span") or "X-Span-Id"] = span["spanId"]
        spec.headers[headers.get("parent") or "traceparent"] = \
            "00-" + span["traceId"] + "-" + span["spanId"] + "-01"

    def PreDone(self, ctx):
        if not self.active:
            return
        result = ctx.result
        ok = result is not None and result.ok is not False and result.err is None
        self._close(ctx, ok)

    def PreUnexpected(self, ctx):
        if not self.active:
            return
        self._close(ctx, False)

    def _close(self, ctx, ok):
        # Close once per operation; a PreDone followed by a pipeline raise
        # (non-2xx) fires PreUnexpected too, which then finds no open span.
        span = getattr(ctx, "_telemetry_span", None)
        if span is None:
            return
        del ctx._telemetry_span

        span["end"] = self._now()
        span["durationMs"] = max(0, span["end"] - span["start"])
        span["ok"] = ok

        telemetry = self.client._telemetry
        telemetry["active"] -= 1
        telemetry["spans"].append(span)

        exporter = self.options.get("exporter")
        if callable(exporter):
            try:
                exporter(span)
            except Exception:
                pass

    def _id(self, kind):
        idgen = self.options.get("idgen")
        if callable(idgen):
            return idgen(kind)
        # Deterministic-ish sequential id; unique within a client instance.
        self.seq += 1
        n = format(self.seq, "04x")
        return ("t" if kind == "trace" else "s") + n.ljust(16, "0")

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000
