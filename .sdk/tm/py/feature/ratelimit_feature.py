# ZefoyTiktokBot SDK ratelimit feature

from __future__ import annotations
import math
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Client-side rate limiting via a token bucket. Each request consumes a
# token; when the bucket is empty the request waits until the bucket
# refills at `rate` tokens per second (with capacity `burst`, default:
# `rate`). This keeps the client under a server's published quota rather
# than discovering it via 429s. The clock (`now`) and the wait (`sleep`)
# are injectable so the accounting can be tested deterministically without
# wall-clock timing.
class ZefoyTiktokBotRatelimitFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "ratelimit"
        self.active = True
        self.client = None
        self.options = {}
        self.tokens = 0
        self.last = 0

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        if not self.active:
            return

        rate = self.options.get("rate") or 5
        burst = rate if self.options.get("burst") is None else self.options.get("burst")
        self.tokens = burst
        self.last = self._now()

        utility = ctx.utility
        inner = utility.fetcher

        def ratelimit_fetcher(fctx, fullurl, fetchdef):
            self._acquire(fctx)
            return inner(fctx, fullurl, fetchdef)

        utility.fetcher = ratelimit_fetcher

    def _acquire(self, ctx):
        rate = self.options.get("rate") or 5
        burst = rate if self.options.get("burst") is None else self.options.get("burst")

        # Refill according to elapsed time.
        now = self._now()
        elapsed = now - self.last
        self.last = now
        self.tokens = min(burst, self.tokens + (elapsed / 1000.0) * rate)

        if self.tokens >= 1:
            self.tokens -= 1
            return

        # Not enough tokens: wait for one to accrue, then consume it.
        needed = 1 - self.tokens
        wait_ms = int(math.ceil((needed / rate) * 1000))
        self._track(ctx, wait_ms)
        self._sleep(wait_ms)
        self.last = self._now()
        self.tokens = 0

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000

    def _sleep(self, ms):
        if ms is None or ms <= 0:
            return
        sleep = self.options.get("sleep")
        if callable(sleep):
            sleep(ms)
            return
        time.sleep(ms / 1000.0)

    def _track(self, ctx, wait_ms):
        client = self.client
        track = getattr(client, "_ratelimit", None)
        if track is None:
            track = {"throttled": 0, "waitMs": 0}
            client._ratelimit = track
        track["throttled"] += 1
        track["waitMs"] += wait_ms
