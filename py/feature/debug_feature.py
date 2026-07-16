# ZefoyTiktokBot SDK debug feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Request/response capture for debugging. Records a bounded ring buffer of
# per-operation traces — method, URL, redacted headers, response status and
# timing — on `client._debug["entries"]`. Sensitive header values (matching
# `redact`, default authorization/cookie/api-key style names) are masked.
# An optional `onEntry` callback receives each finished entry (e.g. to
# stream to a console). `max` caps the buffer (default 100).
class ZefoyTiktokBotDebugFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "debug"
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
        if getattr(client, "_debug", None) is None:
            client._debug = {"entries": []}

    def PreRequest(self, ctx):
        if not self.active:
            return

        spec = ctx.spec
        opname = "_._"
        if ctx.op is not None:
            opname = (ctx.op.entity or "_") + "." + (ctx.op.name or "_")

        entry = {
            "op": opname,
            "method": spec.method if spec is not None else None,
            "url": (spec.url or spec.path) if spec is not None else None,
            "headers": self._redact(spec.headers if spec is not None else None),
            "start": self._now(),
            "status": None,
            "ok": None,
            "durationMs": None,
            "error": None,
        }
        ctx._debug_entry = entry

    def PreResponse(self, ctx):
        if not self.active:
            return

        entry = getattr(ctx, "_debug_entry", None)
        if entry is None:
            return
        response = ctx.response
        if response is not None:
            if isinstance(response, dict):
                entry["status"] = response.get("status")
            else:
                entry["status"] = getattr(response, "status", None)
            if not entry["url"] and ctx.spec is not None:
                entry["url"] = ctx.spec.url

    def PreDone(self, ctx):
        if not self.active:
            return
        self._finish(ctx, True)

    def PreUnexpected(self, ctx):
        if not self.active:
            return
        entry = getattr(ctx, "_debug_entry", None)
        if entry is not None and ctx.ctrl is not None:
            err = getattr(ctx.ctrl, "err", None)
            if err is not None:
                entry["error"] = getattr(err, "msg", None) or str(err)
        self._finish(ctx, False)

    def _finish(self, ctx, ok):
        entry = getattr(ctx, "_debug_entry", None)
        if entry is None:
            return
        del ctx._debug_entry

        result = ctx.result
        entry["ok"] = ok and (result is None or result.ok is not False)
        entry["durationMs"] = max(0, self._now() - entry["start"])
        if entry["status"] is None and result is not None:
            entry["status"] = result.status

        buf = self.client._debug["entries"]
        buf.append(entry)
        mx = 100 if self.options.get("max") is None else self.options.get("max")
        while len(buf) > mx:
            buf.pop(0)

        on_entry = self.options.get("onEntry")
        if callable(on_entry):
            try:
                on_entry(entry)
            except Exception:
                pass

    def _redact(self, headers):
        if headers is None:
            return {}
        patterns = self.options.get("redact") or [
            "authorization", "cookie", "set-cookie", "api-key",
            "apikey", "x-api-key", "idempotency-key",
        ]
        out = {}
        for key in headers:
            if str(key).lower() in patterns:
                out[key] = "<redacted>"
            else:
                out[key] = headers[key]
        return out

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000
