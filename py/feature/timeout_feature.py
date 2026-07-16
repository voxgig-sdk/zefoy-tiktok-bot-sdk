# ZefoyTiktokBot SDK timeout feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Per-request timeout. Wraps the active transport with a deadline of `ms`
# milliseconds (default 30000; <= 0 disables). The transport is synchronous
# in Python, so the fetch definition is annotated with a `timeout` (in
# seconds, for transports like urllib/requests that honour it) and the
# elapsed time of each attempt is checked against the deadline; when the
# deadline is exceeded the request resolves to a `timeout` error instead of
# a late response. The clock (`now`) is injectable for deterministic tests.
class ZefoyTiktokBotTimeoutFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "timeout"
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

        if not self.active:
            return

        utility = ctx.utility
        inner = utility.fetcher

        def timeout_fetcher(fctx, fullurl, fetchdef):
            return self._with_timeout(fctx, fullurl, fetchdef, inner)

        utility.fetcher = timeout_fetcher

    def _with_timeout(self, ctx, url, fetchdef, inner):
        ms = 30000 if self.options.get("ms") is None else self.options.get("ms")
        if ms <= 0:
            return inner(ctx, url, fetchdef)

        # Annotate the fetch definition so a real transport can cancel the
        # request itself (Python-idiomatic analog of an abort signal).
        fetchdef = dict(fetchdef) if isinstance(fetchdef, dict) else {}
        fetchdef["timeout"] = ms / 1000.0

        start = self._now()
        res, err = inner(ctx, url, fetchdef)
        elapsed = self._now() - start

        if elapsed > ms:
            self._track(ctx, ms)
            return None, ctx.make_error("timeout",
                "Request exceeded timeout of " + str(ms) + "ms")

        return res, err

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000

    def _track(self, ctx, ms):
        client = self.client
        track = getattr(client, "_timeout", None)
        if track is None:
            track = {"count": 0, "ms": ms}
            client._timeout = track
        track["count"] += 1
