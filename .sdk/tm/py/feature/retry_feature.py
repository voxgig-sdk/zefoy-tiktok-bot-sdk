# ZefoyTiktokBot SDK retry feature

from __future__ import annotations
import random
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Automatic retry of transient failures with exponential backoff and
# jitter. Wraps the active transport so a single operation call may make
# several HTTP attempts. A failure is retryable when the transport returns
# an error (or raises), or responds with a status in `statuses`
# (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
# `Retry-After` header overrides the computed backoff.
class ZefoyTiktokBotRetryFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "retry"
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

        def retry_fetcher(fctx, fullurl, fetchdef):
            return self._with_retry(fctx, fullurl, fetchdef, inner)

        utility.fetcher = retry_fetcher

    def _with_retry(self, ctx, url, fetchdef, inner):
        opts = self.options
        retries = 2 if opts.get("retries") is None else int(opts.get("retries"))
        min_delay = 50 if opts.get("minDelay") is None else opts.get("minDelay")
        max_delay = 2000 if opts.get("maxDelay") is None else opts.get("maxDelay")
        factor = 2 if opts.get("factor") is None else opts.get("factor")

        attempt = 0

        while True:
            res = None
            err = None
            raised = None
            try:
                res, err = inner(ctx, url, fetchdef)
            except Exception as e:
                raised = e

            if not self._retryable(res, err, raised) or attempt >= retries:
                # Out of attempts: re-raise a raised error to preserve
                # pipeline semantics, otherwise return the last response.
                if raised is not None:
                    raise raised
                return res, err

            wait = self._backoff(res, attempt, min_delay, max_delay, factor)
            self._track(ctx, attempt + 1, res, err, raised, wait)
            self._sleep(wait)
            attempt += 1

    def _retryable(self, res, err, raised):
        if raised is not None or err is not None:
            return True
        if res is None:
            return True
        status = res.get("status") if isinstance(res, dict) else None
        if not isinstance(status, (int, float)) or isinstance(status, bool):
            return False
        statuses = self.options.get("statuses") or [408, 425, 429, 500, 502, 503, 504]
        return int(status) in statuses

    def _backoff(self, res, attempt, min_delay, max_delay, factor):
        # Honour a server-provided Retry-After (seconds) when present.
        ra = self._retry_after(res)
        if ra is not None:
            return min(max_delay, ra)
        base = min_delay * (factor ** attempt)
        jitter = 0 if self.options.get("jitter") is False else int(random.random() * min_delay)
        return min(max_delay, base + jitter)

    def _retry_after(self, res):
        if not isinstance(res, dict):
            return None
        headers = res.get("headers")
        if not isinstance(headers, dict):
            return None
        val = None
        for key in headers:
            if str(key).lower() == "retry-after":
                val = headers[key]
                break
        if val is None:
            return None
        try:
            return float(val) * 1000
        except (TypeError, ValueError):
            return None

    def _sleep(self, ms):
        if ms is None or ms <= 0:
            return
        sleep = self.options.get("sleep")
        if callable(sleep):
            sleep(ms)
            return
        time.sleep(ms / 1000.0)

    def _track(self, ctx, attempt, res, err, raised, wait):
        client = self.client
        track = getattr(client, "_retry", None)
        if track is None:
            track = {"attempts": 0, "retries": []}
            client._retry = track
        track["attempts"] += 1

        status = res.get("status") if isinstance(res, dict) else None
        error = None
        if raised is not None:
            error = str(raised)
        elif err is not None:
            error = str(err)

        track["retries"].append({
            "attempt": attempt,
            "status": status,
            "error": error,
            "wait": wait,
        })
