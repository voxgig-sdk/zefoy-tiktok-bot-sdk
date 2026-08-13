# ZefoyTiktokBot SDK feature test harness
#
# Offline feature-test harness for the generated SDK.
#
# Feature behaviour (retry, cache, rbac, telemetry, ...) is unit-tested by
# driving each feature class through a faithful miniature of the real
# operation pipeline against a configurable mock transport — the same hook
# order and short-circuit rules as the generated entity op code, but with
# no live server and no API-specific fixtures. Feature instances are built
# via the generated `features._make_feature`, so only features actually
# present in this SDK are exercised (see `has_feature`).

from __future__ import annotations

from urllib.parse import quote

from projectname_sdk.config import make_config
from projectname_sdk.features import _make_feature
from projectname_sdk.core.control import ZefoyTiktokBotControl
from projectname_sdk.core.error import ZefoyTiktokBotError
from projectname_sdk.core.result import ZefoyTiktokBotResult
from projectname_sdk.core.spec import ZefoyTiktokBotSpec


# True when this SDK was generated with the named feature.
def has_feature(name):
    feature = make_config().get("feature")
    return isinstance(feature, dict) and feature.get(name) is not None


# A deterministic virtual clock: `now()` advances only when `sleep(ms)` is
# called, so timing-based features can be asserted without real delays.
class Clock:
    def __init__(self, start=0):
        self._t = start

    def now(self):
        return self._t

    def sleep(self, ms):
        self._t += ms or 0

    def advance(self, ms):
        self._t += ms

    @property
    def time(self):
        return self._t


def make_clock(start=0):
    return Clock(start)


# Build a transport-shaped response the pipeline understands.
def make_response(status, data=None, headers=None):
    lower = {}
    for key, val in (headers or {}).items():
        lower[str(key).lower()] = val
    return {
        "status": status,
        "statusText": "OK" if isinstance(status, int) and status < 400 else "ERR",
        "body": "not-used",
        "json": lambda: data,
        "headers": lower,
    }


def default_server():
    def server(_ctx, _url, fetchdef):
        method = str(fetchdef.get("method") or "GET").upper()
        if method == "GET":
            return make_response(200, {"ok": True, "method": method}), None
        return make_response(200, {"ok": True, "method": method,
                                    "echo": fetchdef.get("body")}), None
    return server


# A transport that records every call. `reply(n, fetchdef)` may return a
# response dict or a (response, err) tuple.
def recording_server(reply=None):
    calls = []

    def server(_ctx, url, fetchdef):
        calls.append({"url": url, "fetchdef": fetchdef})
        if reply is not None:
            out = reply(len(calls), fetchdef)
            if isinstance(out, tuple):
                return out
            return out, None
        return make_response(200, {"ok": True, "n": len(calls)}), None

    return server, calls


def default_method(op):
    if op == "create":
        return "POST"
    if op == "update":
        return "PATCH"
    if op == "remove":
        return "DELETE"
    return "GET"


def build_url(spec):
    query = spec.query or {}
    keys = sorted(key for key in query if query[key] is not None)
    qs = "&".join(
        quote(str(key), safe="") + "=" + quote(str(query[key]), safe="")
        for key in keys)
    return spec.base + (spec.path or "") + (("?" + qs) if qs else "")


class _Utility:
    def __init__(self, fetcher):
        self.fetcher = fetcher

        def param(ctx, name):
            params = ctx.spec.params if ctx.spec is not None else {}
            query = ctx.spec.query if ctx.spec is not None else {}
            val = (params or {}).get(name)
            return val if val is not None else (query or {}).get(name)

        self.param = param


class _Client:
    def __init__(self, mode, options):
        self.mode = mode
        self.features = []
        self.options = options

    def options_map(self):
        return self.options


class _Op:
    def __init__(self, name, entity):
        self.name = name
        self.entity = entity
        self.input = "match"
        self.points = []
        self.alias = None


class _Entity:
    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name


class _Ctx:
    _seq = 0

    def __init__(self, client, utility, op=None, entity=None, ctrl=None):
        _Ctx._seq += 1
        self.id = "C" + str(_Ctx._seq)
        self.client = client
        self.utility = utility
        self.out = {}
        self.ctrl = ctrl if ctrl is not None else ZefoyTiktokBotControl()
        self.meta = {}
        self.op = op
        self.entity = entity
        self.spec = None
        self.response = None
        self.result = None
        self.shared = {}

    def make_error(self, code, msg):
        return ZefoyTiktokBotError(code, msg, self)


# Construct a fake client wired with the given features (in init order) and
# a mini operation pipeline. `features` is a list of {"name", "options"}.
class Harness:
    def __init__(self, features, server=None, mode="test",
                 base="http://api.test", headers=None):
        self.base = base
        self.headers = headers or {}
        self.server = server if server is not None else default_server()
        self.utility = _Utility(self.server)
        self.client = _Client(mode, {
            "base": base,
            "headers": dict(self.headers),
            "feature": {},
        })

        self.rootctx = _Ctx(self.client, self.utility,
                            op=_Op("root", "_"), entity=None)

        # Instantiate + init the requested features (skipping any not present
        # in this SDK), then fire PostConstruct.
        for fspec in features:
            name = fspec["name"]
            if not has_feature(name):
                continue
            feature = _make_feature(name)
            fopts = {"active": True}
            for key, val in (fspec.get("options") or {}).items():
                fopts[key] = val
            self.client.options["feature"][feature.get_name()] = fopts
            feature.init(self.rootctx, fopts)
            self.client.features.append(feature)

        self.feature_hook(self.rootctx, "PostConstruct")

    def feature(self, name):
        for feature in self.client.features:
            if feature.get_name() == name:
                return feature
        return None

    def feature_hook(self, ctx, name):
        for feature in self.client.features:
            method = getattr(feature, name, None)
            if callable(method):
                method(ctx)

    def _populate_result(self, ctx, response, fetch_err):
        result = ZefoyTiktokBotResult({})
        ctx.result = result

        if fetch_err is not None:
            result.err = fetch_err
            return
        if response is None:
            result.err = ctx.make_error("request_no_response",
                                        "response: undefined")
            return
        if isinstance(response, Exception):
            result.err = response
            return

        result.status = response.get("status")
        result.status_text = response.get("statusText") or ""
        result.headers = dict(response.get("headers") or {})

        json_func = response.get("json")
        if callable(json_func):
            try:
                result.body = json_func()
            except Exception as err:
                result.err = err
        result.resdata = result.body

        if isinstance(result.status, int) and result.status >= 400:
            result.err = ctx.make_error("request_status",
                "request: " + str(result.status) + ": " + result.status_text)
        elif response.get("err") is not None:
            result.err = response.get("err")

        if result.err is None:
            result.ok = True

    # Run one operation through the mini pipeline (mirrors the generated
    # entity _run_op: hook, short-circuit, make*, hook, ...).
    def op(self, op="load", entity="widget", method=None, path=None,
           query=None, headers=None, body=None, ctrl=None):
        opname = op
        method = method or default_method(opname)

        ctx = _Ctx(self.client, self.utility,
                   op=_Op(opname, entity),
                   entity=_Entity(entity),
                   ctrl=ZefoyTiktokBotControl(ctrl or {}))

        self.feature_hook(ctx, "PostConstructEntity")

        try:
            self.feature_hook(ctx, "PrePoint")
            pre_point = ctx.out.get("point")
            if isinstance(pre_point, Exception):
                raise pre_point

            self.feature_hook(ctx, "PreSpec")
            spec = ctx.out.get("spec")
            if spec is None:
                merged = dict(self.headers)
                for key, val in (headers or {}).items():
                    merged[key] = val
                spec = ZefoyTiktokBotSpec({
                    "method": method,
                    "base": self.base,
                    "path": path if path is not None else "/" + entity,
                    "params": {},
                    "headers": merged,
                    "query": dict(query or {}),
                    "body": body,
                    "step": "start",
                })
            ctx.spec = spec

            self.feature_hook(ctx, "PreRequest")
            ctx.spec.url = build_url(ctx.spec)

            response = ctx.out.get("request")
            fetch_err = None
            if response is None:
                fetchdef = {
                    "url": ctx.spec.url,
                    "method": ctx.spec.method,
                    "headers": ctx.spec.headers,
                    "body": ctx.spec.body,
                }
                response, fetch_err = self.utility.fetcher(
                    ctx, fetchdef["url"], fetchdef)
            ctx.response = response

            self.feature_hook(ctx, "PreResponse")
            self._populate_result(ctx, response, fetch_err)
            self.feature_hook(ctx, "PreResult")
            self.feature_hook(ctx, "PreDone")

            if ctx.result is not None and ctx.result.ok:
                return {"ok": True, "data": ctx.result.resdata,
                        "result": ctx.result, "ctx": ctx, "error": None}

            err = ctx.result.err if (ctx.result is not None
                                     and ctx.result.err is not None) \
                else ctx.make_error("op_failed", "operation failed")
            raise err
        except Exception as err:
            ctx.ctrl.err = err
            self.feature_hook(ctx, "PreUnexpected")
            return {"ok": False, "error": err, "result": ctx.result,
                    "ctx": ctx, "data": None}


def make_client(features, server=None, mode="test",
                base="http://api.test", headers=None):
    return Harness(features, server=server, mode=mode,
                   base=base, headers=headers)
