# ZefoyTiktokBot SDK log feature

from __future__ import annotations
import sys

from feature.base_feature import ZefoyTiktokBotBaseFeature


class ZefoyTiktokBotLogFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "log"
        self.active = True
        self.client = None
        self.options = None
        self.logger = None

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options

        if options.get("active") is True:
            self.active = True
        else:
            self.active = False

        if self.active:
            if isinstance(options.get("logger"), dict):
                self.logger = options["logger"]
            else:
                self.logger = {
                    "info": lambda msg, *a: sys.stderr.write("[INFO] " + msg + "\n"),
                    "debug": lambda msg, *a: sys.stderr.write("[DEBUG] " + msg + "\n"),
                    "warn": lambda msg, *a: sys.stderr.write("[WARN] " + msg + "\n"),
                    "error": lambda msg, *a: sys.stderr.write("[ERROR] " + msg + "\n"),
                }

    def _loghook(self, hook, ctx, level="info"):
        if self.logger is None:
            return

        opname = ""
        if ctx.op is not None:
            opname = ctx.op.name

        msg = "hook=" + hook + " op=" + opname

        log_fn = self.logger.get(level)
        if callable(log_fn):
            log_fn(msg)

    def PostConstruct(self, ctx):
        self._loghook("PostConstruct", ctx)

    def PostConstructEntity(self, ctx):
        self._loghook("PostConstructEntity", ctx)

    def SetData(self, ctx):
        self._loghook("SetData", ctx)

    def GetData(self, ctx):
        self._loghook("GetData", ctx)

    def SetMatch(self, ctx):
        self._loghook("SetMatch", ctx)

    def GetMatch(self, ctx):
        self._loghook("GetMatch", ctx)

    def PrePoint(self, ctx):
        self._loghook("PrePoint", ctx)

    def PreSpec(self, ctx):
        self._loghook("PreSpec", ctx)

    def PreRequest(self, ctx):
        self._loghook("PreRequest", ctx)

    def PreResponse(self, ctx):
        self._loghook("PreResponse", ctx)

    def PreResult(self, ctx):
        self._loghook("PreResult", ctx)
