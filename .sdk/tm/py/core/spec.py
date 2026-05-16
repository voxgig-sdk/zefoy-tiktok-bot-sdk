# ZefoyTiktokBot SDK spec

from __future__ import annotations


class ZefoyTiktokBotSpec:
    def __init__(self, specmap=None):
        if specmap is None:
            specmap = {}

        self.parts = specmap.get("parts", [])
        self.headers = specmap.get("headers", {})
        self.alias = specmap.get("alias", {})
        self.base = specmap.get("base", "")
        self.prefix = specmap.get("prefix", "")
        self.suffix = specmap.get("suffix", "")
        self.params = specmap.get("params", {})
        self.query = specmap.get("query", {})
        self.step = specmap.get("step", "")
        self.method = specmap.get("method", "GET")
        self.body = specmap.get("body")
        self.url = specmap.get("url", "")
        self.path = specmap.get("path", "")
