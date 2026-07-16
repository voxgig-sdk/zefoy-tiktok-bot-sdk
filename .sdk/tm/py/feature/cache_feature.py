# ZefoyTiktokBot SDK cache feature

from __future__ import annotations
import time

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Response caching for safe (read) requests. Wraps the active transport and
# serves a fresh cached snapshot instead of hitting the network when the
# same method+URL was fetched within `ttl` ms (default 5000). Only
# successful (2xx) responses to cacheable methods (default: GET) are
# stored, keyed by method+URL. The cache is bounded (`max` entries, default
# 256, oldest evicted first) and every hit/miss is recorded on
# `client._cache` for inspection. Response bodies are snapshotted on
# capture so both the current caller and later hits can read the JSON body
# repeatedly.
class ZefoyTiktokBotCacheFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "cache"
        self.active = True
        self.client = None
        self.options = {}
        self.store = {}

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        if not self.active:
            return

        self.store = {}

        utility = ctx.utility
        inner = utility.fetcher

        def cache_fetcher(fctx, fullurl, fetchdef):
            return self._through(fctx, fullurl, fetchdef, inner)

        utility.fetcher = cache_fetcher

    def _through(self, ctx, url, fetchdef, inner):
        method = "GET"
        if isinstance(fetchdef, dict) and fetchdef.get("method") is not None:
            method = str(fetchdef.get("method")).upper()
        methods = self.options.get("methods") or ["GET"]

        if method not in methods:
            return inner(ctx, url, fetchdef)

        key = method + " " + url
        now = self._now()
        hit = self.store.get(key)

        if hit is not None and hit["expiry"] > now:
            self._track("hit")
            return self._replay(hit["snapshot"]), None

        res, err = inner(ctx, url, fetchdef)

        if err is None and self._cacheable(res):
            snapshot = self._snapshot(res)
            ttl = 5000 if self.options.get("ttl") is None else self.options.get("ttl")
            self._evict()
            self.store[key] = {"expiry": now + ttl, "snapshot": snapshot}
            self._track("miss")
            return self._replay(snapshot), None

        self._track("bypass")
        return res, err

    def _cacheable(self, res):
        if not isinstance(res, dict):
            return False
        status = res.get("status")
        if not isinstance(status, (int, float)) or isinstance(status, bool):
            return False
        return 200 <= status < 300

    def _snapshot(self, res):
        data = None
        json_func = res.get("json")
        if callable(json_func):
            try:
                data = json_func()
            except Exception:
                data = None
        headers = {}
        raw = res.get("headers")
        if isinstance(raw, dict):
            for key, val in raw.items():
                headers[str(key).lower()] = val
        return {
            "status": res.get("status"),
            "statusText": res.get("statusText"),
            "data": data,
            "headers": headers,
        }

    def _replay(self, snapshot):
        data = snapshot.get("data")
        return {
            "status": snapshot.get("status"),
            "statusText": snapshot.get("statusText"),
            "body": "not-used",
            "json": lambda: data,
            "headers": dict(snapshot.get("headers") or {}),
        }

    def _evict(self):
        mx = 256 if self.options.get("max") is None else self.options.get("max")
        while len(self.store) >= mx:
            oldest = next(iter(self.store), None)
            if oldest is None:
                break
            del self.store[oldest]

    def _now(self):
        now = self.options.get("now")
        if callable(now):
            return now()
        return time.time() * 1000

    def _track(self, kind):
        client = self.client
        track = getattr(client, "_cache", None)
        if track is None:
            track = {"hit": 0, "miss": 0, "bypass": 0}
            client._cache = track
        track[kind] += 1
