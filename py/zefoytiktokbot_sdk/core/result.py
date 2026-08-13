# ZefoyTiktokBot SDK result

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


class ZefoyTiktokBotResult:
    def __init__(self, resmap=None):
        if resmap is None:
            resmap = {}

        self.ok = False
        if vs.getprop(resmap, "ok") is True:
            self.ok = True

        self.status = -1
        s = vs.getprop(resmap, "status")
        if s is not None:
            if isinstance(s, (int, float)):
                self.status = int(s)

        self.status_text = ""
        st = vs.getprop(resmap, "statusText")
        if isinstance(st, str):
            self.status_text = st

        self.headers = {}
        h = vs.getprop(resmap, "headers")
        if isinstance(h, dict):
            self.headers = h

        self.body = vs.getprop(resmap, "body")

        self.err = None
        e = vs.getprop(resmap, "err")
        if e is not None:
            self.err = e

        self.resdata = vs.getprop(resmap, "resdata")

        self.resmatch = None
        rm = vs.getprop(resmap, "resmatch")
        if isinstance(rm, dict):
            self.resmatch = rm
