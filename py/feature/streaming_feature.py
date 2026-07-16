# ZefoyTiktokBot SDK streaming feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Streaming result support. For list-style operations it attaches a
# `result.stream()` generator so callers can consume items incrementally
# with `for item in result.stream():` instead of materialising the whole
# list. The generator reads the result's data lazily, so it reflects the
# parsed entities. A `chunkDelay` (ms) simulates paced/chunked delivery for
# offline tests via the injectable `sleep`; a `chunkSize` groups items into
# batches when set.
class ZefoyTiktokBotStreamingFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "streaming"
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

    def PreResult(self, ctx):
        if not self.active:
            return
        if not self._streamable(ctx):
            return
        result = ctx.result
        if result is None:
            return

        result.streaming = True
        result.stream = lambda: self._iterate(result)

        client = self.client
        track = getattr(client, "_streaming", None)
        if track is None:
            track = {"opened": 0}
            client._streaming = track
        track["opened"] += 1

    def _iterate(self, result):
        chunk_delay = self.options.get("chunkDelay") or 0
        chunk_size = self.options.get("chunkSize") or 0

        # Read lazily so downstream result processing is reflected.
        items = result.resdata if isinstance(result.resdata, list) else []

        if chunk_size > 0:
            for i in range(0, len(items), chunk_size):
                if chunk_delay > 0:
                    self._sleep(chunk_delay)
                yield items[i:i + chunk_size]
            return

        for item in items:
            if chunk_delay > 0:
                self._sleep(chunk_delay)
            yield item

    def _streamable(self, ctx):
        ops = self.options.get("ops") or ["list"]
        opname = ctx.op.name if ctx.op is not None else None
        return opname in ops

    def _sleep(self, ms):
        if ms is None or ms <= 0:
            return
        sleep = self.options.get("sleep")
        if callable(sleep):
            sleep(ms)
            return
        time.sleep(ms / 1000.0)
