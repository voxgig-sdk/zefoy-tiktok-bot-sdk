# ZefoyTiktokBot SDK proxy feature

from __future__ import annotations
import os
import re

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Outbound HTTP(S) proxy support. Wraps the active transport and attaches
# proxy routing to each request's fetch definition. The proxy target comes
# from options (`url`) or, when `fromEnv` is set, the standard
# HTTPS_PROXY / HTTP_PROXY / NO_PROXY environment variables. The request is
# annotated Python-idiomatically: `fetchdef["proxy"]` carries the proxy URL
# and `fetchdef["proxies"]` carries a requests-style scheme map, for a
# custom `system.fetch` transport to honour. An `agent` factory may also be
# supplied (mirroring the ts target); its product is attached as
# `fetchdef["agent"]` / `fetchdef["dispatcher"]`. Hosts matching `noProxy`
# bypass the proxy.
class ZefoyTiktokBotProxyFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "proxy"
        self.active = True
        self.client = None
        self.options = {}
        self.url = None
        self.no_proxy = []

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        if not self.active:
            return

        self.url = self.options.get("url")
        no_proxy = self.options.get("noProxy")

        if self.options.get("fromEnv") is True:
            self.url = (self.url
                        or os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
                        or os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy"))
            no_proxy = (no_proxy
                        or os.environ.get("NO_PROXY") or os.environ.get("no_proxy"))

        if isinstance(no_proxy, str):
            no_proxy = re.split(r"\s*,\s*", no_proxy)
        self.no_proxy = [s for s in (no_proxy or []) if s is not None and s != ""]

        utility = ctx.utility
        inner = utility.fetcher

        def proxy_fetcher(fctx, fullurl, fetchdef):
            fetchdef = self._route(fullurl, fetchdef)
            return inner(fctx, fullurl, fetchdef)

        utility.fetcher = proxy_fetcher

    def _route(self, url, fetchdef):
        if self.url is None or self._bypass(url):
            return fetchdef

        out = dict(fetchdef) if isinstance(fetchdef, dict) else {}
        out["proxy"] = self.url
        out["proxies"] = {"http": self.url, "https": self.url}

        agent = self.options.get("agent")
        if callable(agent):
            # Factory returns a transport-specific agent/dispatcher.
            made = agent(self.url, url)
            out["dispatcher"] = made
            out["agent"] = made

        self._track(url)
        return out

    def _bypass(self, url):
        if len(self.no_proxy) == 0:
            return False
        host = url
        m = re.match(r"^[a-z]+://([^/:]+)", url, re.IGNORECASE)
        if m:
            host = m.group(1)
        for np in self.no_proxy:
            if np == "*":
                return True
            if host == np or host.endswith("." + re.sub(r"^\.", "", np)):
                return True
        return False

    def _track(self, url):
        client = self.client
        track = getattr(client, "_proxy", None)
        if track is None:
            track = {"routed": 0, "url": self.url}
            client._proxy = track
        track["routed"] += 1
