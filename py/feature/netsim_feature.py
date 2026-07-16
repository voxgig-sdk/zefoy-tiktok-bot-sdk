# ZefoyTiktokBot SDK netsim feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Network behaviour simulation. Wraps the active transport (the live
# fetch or the `test` feature's in-memory mock) and injects realistic
# network conditions so offline unit tests can exercise slowness,
# transient failures, rate limiting and outages deterministically.
#
# Every injection mode is counter-driven (per client instance) so tests
# are reproducible without mocking timers. `failRate` adds optional
# pseudo-random failures via a seeded LCG for coverage-style testing.
class ZefoyTiktokBotNetsimFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "netsim"
        self.active = True
        self.client = None
        self.options = {}
        self.calls = 0
        self.seed = 1

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        seed = self.options.get("seed")
        self.seed = int(seed) if isinstance(seed, (int, float)) and int(seed) != 0 else 1

        if not self.active:
            return

        utility = ctx.utility
        inner = utility.fetcher

        def netsim_fetcher(fctx, fullurl, fetchdef):
            return self._simulate(fctx, fullurl, fetchdef, inner)

        utility.fetcher = netsim_fetcher

    def _simulate(self, ctx, url, fetchdef, inner):
        opts = self.options
        self.calls += 1
        call = self.calls

        # Record the simulated conditions for test/debug inspection.
        applied = {}

        # Total outage: every call fails at the transport level.
        if opts.get("offline") is True:
            self._sleep(self._pick_latency())
            applied["offline"] = True
            self._track(ctx, applied)
            return None, ctx.make_error("netsim_offline",
                'Simulated network offline (URL was: "' + url + '")')

        # Connection-level errors for the first N calls (e.g. ECONNRESET).
        if call <= int(opts.get("errorTimes") or 0):
            self._sleep(self._pick_latency())
            applied["error"] = True
            self._track(ctx, applied)
            return None, ctx.make_error("netsim_conn",
                "Simulated connection error (call " + str(call) + ")")

        # Rate-limit responses (HTTP 429 + Retry-After) for the first N calls.
        if call <= int(opts.get("rateLimitTimes") or 0):
            self._sleep(self._pick_latency())
            applied["rateLimited"] = True
            self._track(ctx, applied)
            retry_after = opts.get("retryAfter")
            retry_after = 0 if retry_after is None else retry_after
            return self._respond(ctx, 429, None, {
                "statusText": "Too Many Requests",
                "headers": {"retry-after": str(retry_after)},
            })

        # Retryable failure status for the first N calls, or every Nth call.
        fail_status = 503 if opts.get("failStatus") is None else opts.get("failStatus")
        fail_every = int(opts.get("failEvery") or 0)
        fail_rate = opts.get("failRate") or 0
        fail_by_count = call <= int(opts.get("failTimes") or 0)
        fail_by_every = fail_every > 0 and call % fail_every == 0
        fail_by_rate = fail_rate > 0 and self._rand() < fail_rate
        if fail_by_count or fail_by_every or fail_by_rate:
            self._sleep(self._pick_latency())
            applied["failStatus"] = fail_status
            self._track(ctx, applied)
            return self._respond(ctx, fail_status, None,
                {"statusText": "Simulated Failure"})

        # Otherwise: apply latency then delegate to the real transport.
        latency = self._pick_latency()
        applied["latency"] = latency
        self._track(ctx, applied)
        self._sleep(latency)
        return inner(ctx, url, fetchdef)

    # Latency in ms: a fixed number, or a uniform sample from {min,max}.
    def _pick_latency(self):
        latency = self.options.get("latency")
        if latency is None:
            return 0
        if isinstance(latency, (int, float)) and not isinstance(latency, bool):
            return 0 if latency < 0 else latency
        if not isinstance(latency, dict):
            return 0
        mn = int(latency.get("min") or 0)
        mx = mn if latency.get("max") is None else int(latency.get("max"))
        if mx <= mn:
            return mn
        return mn + int(self._rand() * (mx - mn))

    def _sleep(self, ms):
        if ms is None or ms <= 0:
            return
        sleep = self.options.get("sleep")
        if callable(sleep):
            sleep(ms)
            return
        time.sleep(ms / 1000.0)

    # Deterministic 0..1 pseudo-random via a linear congruential generator.
    def _rand(self):
        self.seed = (self.seed * 1103515245 + 12345) & 0x7FFFFFFF
        return self.seed / 0x7FFFFFFF

    def _track(self, ctx, applied):
        client = self.client
        track = getattr(client, "_netsim", None)
        if track is None:
            track = {"calls": 0, "applied": []}
            client._netsim = track
        track["calls"] += 1
        track["applied"].append(applied)
        explain = getattr(ctx.ctrl, "explain", None) if ctx.ctrl is not None else None
        if isinstance(explain, dict):
            explain["netsim"] = track

    # Build a transport-shaped response (matching the test feature's mock)
    # with a lower-cased header map the result pipeline understands.
    def _respond(self, ctx, status, data=None, extra=None):
        out = {
            "status": status,
            "statusText": "OK",
            "json": lambda: data,
            "body": "not-used",
        }
        if isinstance(extra, dict):
            for key, val in extra.items():
                out[key] = val

        headers = out.get("headers")
        if not isinstance(headers, dict):
            headers = {}
        lower = {}
        for key, val in headers.items():
            lower[str(key).lower()] = val
        out["headers"] = lower

        return out, None
