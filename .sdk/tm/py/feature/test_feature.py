# ProjectName SDK test feature

from __future__ import annotations
import random

from utility.voxgig_struct import voxgig_struct as vs
from feature.base_feature import ProjectNameBaseFeature


class ProjectNameTestFeature(ProjectNameBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "test"
        self.active = True
        self.client = None
        self.options = None

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options

        entity = vs.getprop(options, "entity")
        if not isinstance(entity, dict):
            entity = {}

        self.client.mode = "test"

        # Ensure entity ids are correct.
        vs.walk(entity, lambda key, val, parent, path: (
            val.__setitem__("id", key) if len(path) == 2 and isinstance(val, dict) and key is not None else None,
            val
        )[-1])

        test_self = self

        def test_fetcher(fctx, _fullurl, _fetchdef):
            def respond(status, data, extra=None):
                out = {
                    "status": status,
                    "statusText": "OK",
                    "json": lambda: data,
                    "body": "not-used",
                }
                if isinstance(extra, dict):
                    for k, v in extra.items():
                        out[k] = v
                return out, None

            op = fctx.op
            entmap = vs.getprop(entity, op.entity)
            if not isinstance(entmap, dict):
                entmap = {}

            # For single-entity ops (load, remove) with an empty explicit
            # match, fall back to the id the entity client already knows from a
            # prior create/load (in fctx.match / fctx.data). Mirrors the TS
            # mock where param() resolves the id from that accumulated state.
            def _resolve_match(explicit):
                if isinstance(explicit, dict) and len(explicit) > 0:
                    return explicit
                for src in (getattr(fctx, "match", None), getattr(fctx, "data", None)):
                    v = vs.getprop(src, "id") if src is not None else None
                    if v is not None and v != "__UNDEFINED__":
                        return {"id": v}
                return {}

            if op.name == "load":
                args = test_self.build_args(fctx, op, _resolve_match(fctx.reqmatch))
                found = vs.select(entmap, args)
                ent = vs.getelem(found, 0)
                if ent is None:
                    return respond(404, None, {"statusText": "Not found"})
                vs.delprop(ent, "$KEY")
                out = vs.clone(ent)
                return respond(200, out)

            elif op.name == "list":
                args = test_self.build_args(fctx, op, fctx.reqmatch)
                found = vs.select(entmap, args)
                if found is None:
                    return respond(404, None, {"statusText": "Not found"})
                if isinstance(found, list):
                    for item in found:
                        vs.delprop(item, "$KEY")
                out = vs.clone(found)
                return respond(200, out)

            elif op.name == "update":
                # Match the existing entity by id only (or its alias). reqdata
                # also contains the new field values, which would otherwise
                # cause select to filter out the entity we want to update.
                # Falls back to first entity when no match found, mirroring
                # the TS mock.
                update_match = {}
                if isinstance(fctx.reqdata, dict):
                    if "id" in fctx.reqdata:
                        update_match["id"] = fctx.reqdata["id"]
                    alias_map = getattr(op, "alias_map", None)
                    if alias_map is not None:
                        alias_id = vs.getprop(alias_map, "id")
                        if alias_id is not None and alias_id in fctx.reqdata:
                            update_match[alias_id] = fctx.reqdata[alias_id]
                args = test_self.build_args(fctx, op, update_match)
                found = vs.select(entmap, args)
                ent = vs.getelem(found, 0)
                if ent is None and isinstance(entmap, dict):
                    for e in entmap.values():
                        if isinstance(e, dict):
                            ent = e
                            break
                if ent is None:
                    return respond(404, None, {"statusText": "Not found"})
                if isinstance(ent, dict):
                    reqdata = fctx.reqdata
                    if reqdata is not None:
                        for k, v in reqdata.items():
                            ent[k] = v
                vs.delprop(ent, "$KEY")
                out = vs.clone(ent)
                return respond(200, out)

            elif op.name == "remove":
                args = test_self.build_args(fctx, op, _resolve_match(fctx.reqmatch))
                found = vs.select(entmap, args)
                ent = vs.getelem(found, 0)
                # Remove only the first matched entity. If nothing matches,
                # succeed as a no-op rather than erroring.
                if isinstance(ent, dict):
                    eid = vs.getprop(ent, "id")
                    vs.delprop(entmap, eid)
                return respond(200, None)

            elif op.name == "create":
                test_self.build_args(fctx, op, fctx.reqdata)
                eid = fctx.utility.param(fctx, "id")
                if eid is None:
                    eid = "%04x%04x%04x%04x" % (
                        random.randint(0, 0xFFFF), random.randint(0, 0xFFFF),
                        random.randint(0, 0xFFFF), random.randint(0, 0xFFFF))

                ent = vs.clone(fctx.reqdata)
                if isinstance(ent, dict):
                    ent["id"] = eid
                    if isinstance(eid, str):
                        entmap[eid] = ent
                    vs.delprop(ent, "$KEY")
                    out = vs.clone(ent)
                    return respond(200, out)
                return respond(200, ent)

            return respond(404, None, {"statusText": "Unknown operation"})

        ctx.utility.fetcher = test_fetcher

    def build_args(self, ctx, op, args):
        opname = op.name

        # Get last point from config.
        points = vs.getpath(ctx.config, "entity." + ctx.entity.get_name() + ".op." + opname + ".points")
        point = vs.getelem(points, -1)

        # Get required params.
        params_path = vs.getpath(point, "args.params")
        reqd_params = vs.select(params_path, {"reqd": True})
        reqd = vs.transform(reqd_params, ["`$EACH`", "", "`$KEY.name`"])

        qand = []
        q = {"`$AND`": qand}

        if args is not None:
            keys = vs.keysof(args)
            if keys is not None:
                for key in keys:
                    is_id = (key == "id")
                    selected = vs.select(reqd, key)
                    is_reqd = not vs.isempty(selected)

                    if is_id or is_reqd:
                        v = ctx.utility.param(ctx, key)
                        ka = None
                        if op.alias is not None:
                            ka = vs.getprop(op.alias, key)

                        qor = [{key: v}]
                        if ka is not None and isinstance(ka, str):
                            qor.append({ka: v})

                        qand.append({"`$OR`": qor})

        q["`$AND`"] = qand

        if ctx.ctrl.explain is not None:
            ctx.ctrl.explain["test"] = {"query": q}

        return q
