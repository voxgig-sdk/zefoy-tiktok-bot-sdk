# ZefoyTiktokBot SDK context

from __future__ import annotations
import random

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.core.control import ZefoyTiktokBotControl
from projectname_sdk.core.operation import ZefoyTiktokBotOperation
from projectname_sdk.core.spec import ZefoyTiktokBotSpec
from projectname_sdk.core.result import ZefoyTiktokBotResult
from projectname_sdk.core.response import ZefoyTiktokBotResponse
from projectname_sdk.core.error import ZefoyTiktokBotError
from projectname_sdk.core.helpers import get_ctx_prop, to_map


class ZefoyTiktokBotContext:
    def __init__(self, ctxmap=None, basectx=None):
        self.id = "C" + str(random.randint(10000000, 99999999))
        self.out = {}

        if ctxmap is None:
            ctxmap = {}

        # Client
        c = get_ctx_prop(ctxmap, "client")
        if c is not None:
            self.client = c
        elif basectx is not None:
            self.client = basectx.client
        else:
            self.client = None

        # Utility
        u = get_ctx_prop(ctxmap, "utility")
        if u is not None:
            self.utility = u
        elif basectx is not None:
            self.utility = basectx.utility
        else:
            self.utility = None

        # Ctrl
        self.ctrl = ZefoyTiktokBotControl()
        ctrl_raw = get_ctx_prop(ctxmap, "ctrl")
        if isinstance(ctrl_raw, dict):
            if ctrl_raw.get("throw_err") is not None:
                self.ctrl.throw_err = ctrl_raw["throw_err"]
            elif isinstance(ctrl_raw.get("throw"), bool):
                self.ctrl.throw_err = ctrl_raw["throw"]
            if isinstance(ctrl_raw.get("explain"), dict):
                self.ctrl.explain = ctrl_raw["explain"]
            if ctrl_raw.get("actor") is not None:
                self.ctrl.actor = ctrl_raw["actor"]
            if isinstance(ctrl_raw.get("paging"), dict):
                self.ctrl.paging = ctrl_raw["paging"]
        elif basectx is not None and basectx.ctrl is not None:
            self.ctrl = basectx.ctrl

        # Meta
        self.meta = {}
        m = get_ctx_prop(ctxmap, "meta")
        if isinstance(m, dict):
            self.meta = m
        elif basectx is not None and basectx.meta is not None:
            self.meta = basectx.meta

        # Config
        cfg = get_ctx_prop(ctxmap, "config")
        if isinstance(cfg, dict):
            self.config = cfg
        elif basectx is not None:
            self.config = basectx.config
        else:
            self.config = None

        # Entopts
        eo = get_ctx_prop(ctxmap, "entopts")
        if isinstance(eo, dict):
            self.entopts = eo
        elif basectx is not None:
            self.entopts = basectx.entopts
        else:
            self.entopts = None

        # Options
        o = get_ctx_prop(ctxmap, "options")
        if isinstance(o, dict):
            self.options = o
        elif basectx is not None:
            self.options = basectx.options
        else:
            self.options = None

        # Entity
        e = get_ctx_prop(ctxmap, "entity")
        if e is not None:
            self.entity = e
        elif basectx is not None:
            self.entity = basectx.entity
        else:
            self.entity = None

        # Shared
        s = get_ctx_prop(ctxmap, "shared")
        if isinstance(s, dict):
            self.shared = s
        elif basectx is not None:
            self.shared = basectx.shared
        else:
            self.shared = None

        # Opmap
        om = get_ctx_prop(ctxmap, "opmap")
        if isinstance(om, dict):
            self.opmap = om
        elif basectx is not None:
            self.opmap = basectx.opmap
        else:
            self.opmap = None
        if self.opmap is None:
            self.opmap = {}

        # Data
        self.data = to_map(get_ctx_prop(ctxmap, "data")) or {}
        self.reqdata = to_map(get_ctx_prop(ctxmap, "reqdata")) or {}
        self.match = to_map(get_ctx_prop(ctxmap, "match")) or {}
        self.reqmatch = to_map(get_ctx_prop(ctxmap, "reqmatch")) or {}

        # Point
        pt = get_ctx_prop(ctxmap, "point")
        if isinstance(pt, dict):
            self.point = pt
        elif basectx is not None:
            self.point = basectx.point
        else:
            self.point = None

        # Spec
        sp = get_ctx_prop(ctxmap, "spec")
        if isinstance(sp, ZefoyTiktokBotSpec):
            self.spec = sp
        elif basectx is not None:
            self.spec = basectx.spec
        else:
            self.spec = None

        # Result
        r = get_ctx_prop(ctxmap, "result")
        if isinstance(r, ZefoyTiktokBotResult):
            self.result = r
        elif basectx is not None:
            self.result = basectx.result
        else:
            self.result = None

        # Response
        rp = get_ctx_prop(ctxmap, "response")
        if isinstance(rp, ZefoyTiktokBotResponse):
            self.response = rp
        elif basectx is not None:
            self.response = basectx.response
        else:
            self.response = None

        # Resolve operation
        opname = get_ctx_prop(ctxmap, "opname") or ""
        self.op = self.resolve_op(opname)

    def resolve_op(self, opname):
        # Cache key is `<entity>:<opname>` so two entities with the same op
        # (e.g. both have a "list") get distinct cached Operations. Keying
        # on opname alone caused the first-resolved entity's points to be
        # served to every subsequent entity's call.
        entname = "_"
        if self.entity is not None and hasattr(self.entity, "get_name") and callable(self.entity.get_name):
            entname = self.entity.get_name()
        cache_key = entname + ":" + opname

        if cache_key in self.opmap:
            return self.opmap[cache_key]

        if opname == "":
            return ZefoyTiktokBotOperation({})

        opcfg = vs.getpath(self.config, "entity." + entname + ".op." + opname)

        inpt = "match"
        if opname == "update" or opname == "create":
            inpt = "data"

        points = []
        if isinstance(opcfg, dict):
            t = vs.getprop(opcfg, "points")
            if isinstance(t, list):
                points = t

        op = ZefoyTiktokBotOperation({
            "entity": entname,
            "name": opname,
            "input": inpt,
            "points": points,
        })

        self.opmap[cache_key] = op
        return op

    def make_error(self, code, msg):
        return ZefoyTiktokBotError(code, msg, self)
