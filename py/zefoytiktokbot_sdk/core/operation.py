# ZefoyTiktokBot SDK operation

from __future__ import annotations
from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs


class ZefoyTiktokBotOperation:
    def __init__(self, opmap=None):
        if opmap is None:
            opmap = {}

        entity = vs.getprop(opmap, "entity")
        if not isinstance(entity, str) or entity == "":
            entity = "_"
        self.entity = entity

        name = vs.getprop(opmap, "name")
        if not isinstance(name, str) or name == "":
            name = "_"
        self.name = name

        inpt = vs.getprop(opmap, "input")
        if not isinstance(inpt, str) or inpt == "":
            inpt = "_"
        self.input = inpt

        self.points = []
        raw_points = vs.getprop(opmap, "points")
        if isinstance(raw_points, list):
            for t in raw_points:
                if isinstance(t, dict):
                    self.points.append(t)

        self.alias = None
        raw_alias = vs.getprop(opmap, "alias")
        if isinstance(raw_alias, dict):
            self.alias = raw_alias
