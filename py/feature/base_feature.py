# ZefoyTiktokBot SDK base feature

from __future__ import annotations


class ZefoyTiktokBotBaseFeature:
    def __init__(self):
        self.version = "0.0.1"
        self.name = "base"
        self.active = True

    def get_version(self):
        return self.version

    def get_name(self):
        return self.name

    def get_active(self):
        return self.active

    def init(self, ctx, options):
        pass

    def PostConstruct(self, ctx):
        pass

    def PostConstructEntity(self, ctx):
        pass

    def SetData(self, ctx):
        pass

    def GetData(self, ctx):
        pass

    def GetMatch(self, ctx):
        pass

    def SetMatch(self, ctx):
        pass

    def PrePoint(self, ctx):
        pass

    def PreSpec(self, ctx):
        pass

    def PreRequest(self, ctx):
        pass

    def PreResponse(self, ctx):
        pass

    def PreResult(self, ctx):
        pass

    def PreDone(self, ctx):
        pass

    def PreUnexpected(self, ctx):
        pass
