# ZefoyTiktokBot SDK response

from __future__ import annotations
from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs


class ZefoyTiktokBotResponse:
    def __init__(self, resmap=None):
        if resmap is None:
            resmap = {}

        self.status = -1
        s = vs.getprop(resmap, "status")
        if s is not None and isinstance(s, (int, float)):
            self.status = int(s)

        self.status_text = ""
        st = vs.getprop(resmap, "statusText")
        if isinstance(st, str):
            self.status_text = st

        self.headers = vs.getprop(resmap, "headers")

        self.json_func = None
        jf = vs.getprop(resmap, "json")
        if callable(jf):
            self.json_func = jf

        self.body = vs.getprop(resmap, "body")

        self.err = None
        e = vs.getprop(resmap, "err")
        if e is not None:
            self.err = e
