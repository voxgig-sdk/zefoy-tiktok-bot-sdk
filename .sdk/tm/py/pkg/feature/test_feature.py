# ProjectName SDK test feature

from __future__ import annotations
import re
import random
import time

from projectname_sdk.utility.voxgig_struct import voxgig_struct as vs
from projectname_sdk.feature.base_feature import ProjectNameBaseFeature


# The `body.<key>` form of an op's response transform: the mock wraps its
# payload in <key> so the transform can unwrap it again.
ENVELOPE_RES_RE = re.compile(r"^`body\.([^`.]+)`$")


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
            # Shape the mock payload the way the real API would, so the op's
            # response transform recovers the entity from it. A point carrying
            # transform.res of `body.item` describes an API that answers
            # {"item": {...}}; handing back the bare entity means the transform
            # unwraps a property that is not there and the caller gets None.
            # The mock has to agree with the model, or it only ever simulates
            # APIs whose responses happen to be unwrapped. Mirrors the ts mock.
            def envelope(data):
                point = getattr(fctx, "point", None)
                if data is None or not isinstance(point, dict):
                    return data
                transform = point.get("transform")
                if not isinstance(transform, dict):
                    return data
                restf = transform.get("res")
                if not isinstance(restf, str):
                    return data
                m = ENVELOPE_RES_RE.match(restf)
                return data if m is None else {m.group(1): data}

            def respond(status, data, extra=None):
                payload = envelope(data)
                out = {
                    "status": status,
                    "statusText": "OK",
                    "json": lambda: payload,
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
                # When reqdata has no id, fall back to the id the entity
                # client carries from a prior create/load (in fctx.match /
                # fctx.data), mirroring the TS mock where param(ctx,'id')
                # resolves from accumulated state.
                update_match = {}
                if isinstance(fctx.reqdata, dict):
                    if "id" in fctx.reqdata:
                        update_match["id"] = fctx.reqdata["id"]
                    alias_map = getattr(op, "alias_map", None)
                    if alias_map is not None:
                        alias_id = vs.getprop(alias_map, "id")
                        if alias_id is not None and alias_id in fctx.reqdata:
                            update_match[alias_id] = fctx.reqdata[alias_id]
                if not update_match:
                    update_match = _resolve_match({})
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

        # Optional network behaviour simulation over the mock transport.
        # Enable per test via SDK.test({"net": {"latency": ..., ...}}). When
        # "net" is absent the mock behaves exactly as before (no wrapping),
        # so existing generated tests are unaffected.
        net = vs.getprop(options, "net")
        if isinstance(net, dict):
            ctx.utility.fetcher = self.make_netsim(net, test_fetcher)
        else:
            ctx.utility.fetcher = test_fetcher

    # Wrap a transport with simulated network conditions: latency (fixed or
    # {min,max}), a budget of first-N failures (failTimes -> failStatus),
    # first-N connection errors (errorTimes), or a hard offline outage.
    # Counter-driven, so simulations are deterministic across a test.
    def make_netsim(self, net, inner):
        self._netcalls = 0

        def pick_latency():
            latency = vs.getprop(net, "latency")
            if latency is None:
                return 0
            if isinstance(latency, (int, float)) and not isinstance(latency, bool):
                return 0 if latency < 0 else latency
            if not isinstance(latency, dict):
                return 0
            mn = int(vs.getprop(latency, "min") or 0)
            mx = vs.getprop(latency, "max")
            mx = mn if mx is None else int(mx)
            return mn if mx <= mn else mn + ((mx - mn) >> 1)

        def sleep(ms):
            if ms is None or ms <= 0:
                return
            net_sleep = vs.getprop(net, "sleep")
            if callable(net_sleep):
                net_sleep(ms)
                return
            time.sleep(ms / 1000.0)

        def netsim_fetcher(fctx, url, fetchdef):
            self._netcalls += 1
            call = self._netcalls

            if vs.getprop(net, "offline") is True:
                sleep(pick_latency())
                return None, fctx.make_error("netsim_offline",
                    'Simulated network offline (URL was: "' + url + '")')

            if call <= int(vs.getprop(net, "errorTimes") or 0):
                sleep(pick_latency())
                return None, fctx.make_error("netsim_conn",
                    "Simulated connection error (call " + str(call) + ")")

            if call <= int(vs.getprop(net, "failTimes") or 0):
                sleep(pick_latency())
                status = vs.getprop(net, "failStatus")
                status = 503 if status is None else status
                return {
                    "status": status,
                    "statusText": "Simulated Failure",
                    "body": "not-used",
                    "json": lambda: None,
                    "headers": {},
                }, None

            sleep(pick_latency())
            return inner(fctx, url, fetchdef)

        return netsim_fetcher

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
