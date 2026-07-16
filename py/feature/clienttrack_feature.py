# ZefoyTiktokBot SDK clienttrack feature

from __future__ import annotations
import random

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Client tracking. Establishes a stable per-client session id at
# construction and stamps identifying headers on every request: a
# `User-Agent`, an `X-Client-Id` (session), and a fresh per-request
# `X-Request-Id`. This lets a server correlate all traffic from one SDK
# instance and each individual call. Header names, client name/version
# (`clientName`/`clientVersion`) and the id generator (`idgen`) are
# configurable; the session id and request counter are exposed on
# `client._clienttrack`. Caller-provided User-Agent / X-Client-Id headers
# are never clobbered.
class ZefoyTiktokBotClienttrackFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "clienttrack"
        self.active = True
        self.client = None
        self.options = {}
        self.session = ""
        self.requests = 0

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

        self.requests = 0

    def PostConstruct(self, ctx):
        if not self.active:
            return
        self.session = self.options.get("sessionId") or self._genid("session")
        self.client._clienttrack = {
            "session": self.session,
            "requests": 0,
            "clientName": self._name(),
        }

    def PreRequest(self, ctx):
        if not self.active:
            return

        spec = ctx.spec
        if spec is None:
            return
        if spec.headers is None:
            spec.headers = {}
        if self.session == "":
            self.session = self.options.get("sessionId") or self._genid("session")

        headers = self.options.get("headers") or {}
        self.requests += 1
        request_id = self._genid("request")

        self._set(spec.headers, headers.get("agent") or "User-Agent", self._name())
        self._set(spec.headers, headers.get("client") or "X-Client-Id", self.session)
        spec.headers[headers.get("request") or "X-Request-Id"] = request_id

        client = self.client
        track = getattr(client, "_clienttrack", None)
        if track is None:
            track = {"session": self.session, "requests": 0, "clientName": self._name()}
            client._clienttrack = track
        track["requests"] = self.requests
        track["lastRequestId"] = request_id

    # Do not clobber a caller-provided value (e.g. a custom User-Agent).
    def _set(self, headers, name, value):
        lower = name.lower()
        for key in headers:
            if str(key).lower() == lower:
                return
        headers[name] = value

    def _name(self):
        name = self.options.get("clientName") or "ZefoyTiktokBot-SDK"
        version = self.options.get("clientVersion") or "0.0.1"
        return name + "/" + version

    def _genid(self, kind):
        idgen = self.options.get("idgen")
        if callable(idgen):
            return idgen(kind)
        return (kind[0] + "-" + "%04x%04x%04x%04x" % (
            random.randint(0, 0xFFFF), random.randint(0, 0xFFFF),
            random.randint(0, 0xFFFF), random.randint(0, 0xFFFF)))[:20]
