# ZefoyTiktokBot SDK primary utility test

import json
import os
import re

import pytest

from zefoytiktokbot_sdk.utility.voxgig_struct import voxgig_struct as vs
from zefoytiktokbot_sdk import ZefoyTiktokBotSDK
from zefoytiktokbot_sdk.core.spec import ZefoyTiktokBotSpec
from zefoytiktokbot_sdk.core.result import ZefoyTiktokBotResult
from zefoytiktokbot_sdk.core.response import ZefoyTiktokBotResponse
from zefoytiktokbot_sdk.core.operation import ZefoyTiktokBotOperation
from zefoytiktokbot_sdk.core.error import ZefoyTiktokBotError
from zefoytiktokbot_sdk.core import helpers
from zefoytiktokbot_sdk.feature.base_feature import ZefoyTiktokBotBaseFeature

_TEST_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_test_spec():
    test_json_path = os.path.join(_TEST_DIR, '../../.sdk/test/test.json')
    with open(test_json_path, 'r') as f:
        return json.loads(f.read())


def _get_spec(spec, *keys):
    cur = spec
    for key in keys:
        if isinstance(cur, dict):
            cur = cur.get(key)
        else:
            return None
    if isinstance(cur, dict):
        return cur
    return None


def _json_normalize(val):
    if val is None:
        return None
    return json.loads(json.dumps(val, default=str))


def _json_str(val):
    try:
        return json.dumps(val, default=str)
    except Exception:
        return str(val)


def _match_string(pattern, val):
    if len(pattern) >= 2 and pattern[0] == '/' and pattern[-1] == '/':
        try:
            return re.search(pattern[1:-1], val) is not None
        except Exception:
            return False
    return pattern.lower() in val.lower()


def _match_deep(errors, check, base, path):
    if check is None:
        return

    if isinstance(check, dict):
        for key, check_val in check.items():
            child_path = path + "." + key
            base_val = None
            if isinstance(base, dict):
                base_val = base.get(key)
            _match_deep(errors, check_val, base_val, child_path)
    elif isinstance(check, list):
        for i, check_val in enumerate(check):
            child_path = "{}[{}]".format(path, i)
            base_val = None
            if isinstance(base, list) and i < len(base):
                base_val = base[i]
            _match_deep(errors, check_val, base_val, child_path)
    else:
        if isinstance(check, str) and check == "__EXISTS__":
            if base is None:
                errors.append("match {}: expected value to exist but got None".format(path))
            return
        if isinstance(check, str) and check == "__UNDEF__":
            if base is not None:
                errors.append("match {}: expected None but got {}".format(path, base))
            return

        norm_check = _json_normalize(check)
        norm_base = _json_normalize(base)

        if norm_check != norm_base:
            if isinstance(check, str) and check != "":
                base_str = vs.stringify(base) if base is not None else ""
                if _match_string(check, base_str):
                    return
            errors.append("match {}: got {}, want {}".format(
                path, _json_str(norm_base), _json_str(norm_check)))


def _runset(testspec, subject):
    if testspec is None:
        return
    entries = testspec.get("set")
    if not isinstance(entries, list):
        return

    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue

        mark = ""
        m = entry.get("mark")
        if m is not None:
            mark = " (mark={})".format(m)

        result = None
        err = None

        try:
            result, err = subject(entry)
        except Exception as e:
            err = e

        expected_err = entry.get("err")

        if err is not None:
            if expected_err is not None:
                err_msg = str(err)
                if isinstance(expected_err, str):
                    assert _match_string(expected_err, err_msg), \
                        "entry {}{}: error mismatch: got {!r}, want contains {!r}".format(
                            i, mark, err_msg, expected_err)
                elif isinstance(expected_err, bool) and expected_err:
                    pass  # any error is acceptable

                match_spec = entry.get("match")
                if isinstance(match_spec, dict):
                    result_map = {
                        "in": entry.get("in"),
                        "out": _json_normalize(result),
                        "err": {"message": str(err)},
                    }
                    errors = []
                    _match_deep(errors, match_spec, result_map, "")
                    assert len(errors) == 0, \
                        "entry {}{}: {}".format(i, mark, "; ".join(errors))
                continue

            pytest.fail("entry {}{}: unexpected error: {}".format(i, mark, err))
            continue

        if expected_err is not None:
            pytest.fail("entry {}{}: expected error containing {!r} but got result: {}".format(
                i, mark, expected_err, _json_str(result)))
            continue

        matched = False
        match_spec = entry.get("match")
        if isinstance(match_spec, dict):
            result_map = {
                "in": entry.get("in"),
                "out": _json_normalize(result),
            }
            if entry.get("args") is not None:
                result_map["args"] = entry["args"]
            elif entry.get("in") is not None:
                result_map["args"] = [entry["in"]]
            if entry.get("ctx") is not None:
                result_map["ctx"] = entry["ctx"]
            errors = []
            _match_deep(errors, match_spec, result_map, "")
            assert len(errors) == 0, \
                "entry {}{}: {}".format(i, mark, "; ".join(errors))
            matched = True

        expected_out = entry.get("out")
        if expected_out is None and matched:
            continue
        if expected_out is not None:
            norm_result = _json_normalize(result)
            norm_expected = _json_normalize(expected_out)
            assert norm_result == norm_expected, \
                "entry {}{}: output mismatch: got {} want {}".format(
                    i, mark, _json_str(norm_result), _json_str(norm_expected))


def _make_ctx_from_map(ctxmap, client, utility):
    if ctxmap is None:
        ctxmap = {}

    ctx = utility.make_context(ctxmap, None)

    if client is not None:
        ctx.client = client
        ctx.utility = utility
    if ctx.options is None and client is not None:
        ctx.options = client.options_map()

    # Handle spec from JSON map
    spec_map = ctxmap.get("spec")
    if isinstance(spec_map, dict):
        ctx.spec = ZefoyTiktokBotSpec(spec_map)

    # Handle result from JSON map
    res_map = ctxmap.get("result")
    if isinstance(res_map, dict):
        ctx.result = ZefoyTiktokBotResult(res_map)
        err_map = res_map.get("err")
        if isinstance(err_map, dict):
            msg = err_map.get("message", "")
            ctx.result.err = ZefoyTiktokBotError("", msg)

    # Handle response from JSON map
    resp_map = ctxmap.get("response")
    if isinstance(resp_map, dict):
        ctx.response = ZefoyTiktokBotResponse(resp_map)
        body = resp_map.get("body")
        if body is not None:
            body_copy = body
            ctx.response.json_func = lambda: body_copy
        headers = resp_map.get("headers")
        if isinstance(headers, dict):
            lower_headers = {}
            for k, v in headers.items():
                lower_headers[k.lower()] = v
            ctx.response.headers = lower_headers

    return ctx


def _fixctx(ctx, client):
    if ctx is not None and ctx.client is not None and ctx.options is None:
        ctx.options = ctx.client.options_map()


def _err_from_map(m):
    if m is None:
        return None
    msg = m.get("message", "")
    if msg == "":
        return None
    code = m.get("code", "")
    return ZefoyTiktokBotError(code, msg)


def _make_test_ctx(client, utility, overrides=None):
    ctxmap = {
        "opname": "load",
        "client": client,
        "utility": utility,
    }
    if overrides is not None:
        for k, v in overrides.items():
            ctxmap[k] = v
    return utility.make_context(ctxmap, client.get_root_ctx())


def _make_test_full_ctx(client, utility):
    ctx = _make_test_ctx(client, utility)
    ctx.point = {
        "parts": ["items", "{id}"],
        "args": {"params": [{"name": "id", "reqd": True}]},
        "params": ["id"],
        "alias": {},
        "select": {},
        "active": True,
        "transform": {},
    }
    ctx.match = {"id": "item01"}
    ctx.reqmatch = {"id": "item01"}
    return ctx


class TestPrimaryUtility:

    def test_exists(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        assert utility.clean is not None
        assert utility.done is not None
        assert utility.make_error is not None
        assert utility.feature_add is not None
        assert utility.feature_hook is not None
        assert utility.feature_init is not None
        assert utility.fetcher is not None
        assert utility.make_fetch_def is not None
        assert utility.make_context is not None
        assert utility.make_options is not None
        assert utility.make_request is not None
        assert utility.make_response is not None
        assert utility.make_result is not None
        assert utility.make_point is not None
        assert utility.make_spec is not None
        assert utility.make_url is not None
        assert utility.param is not None
        assert utility.prepare_auth is not None
        assert utility.prepare_body is not None
        assert utility.prepare_headers is not None
        assert utility.prepare_method is not None
        assert utility.prepare_params is not None
        assert utility.prepare_path is not None
        assert utility.prepare_query is not None
        assert utility.result_basic is not None
        assert utility.result_body is not None
        assert utility.result_headers is not None
        assert utility.transform_request is not None
        assert utility.transform_response is not None

    def test_clean_basic(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        val = {"key": "secret123", "name": "test"}
        cleaned = utility.clean(ctx, val)
        assert cleaned is not None

    def test_done_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            _fixctx(ctx, client)
            # done() returns the bare result data on success and raises on
            # error. Adapt to the (result, err) shape the runner expects.
            try:
                return utility.done(ctx), None
            except ZefoyTiktokBotError as e:
                return None, e

        _runset(_get_spec(primary, "done", "basic"), subject)

    def test_make_error_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            args = entry.get("args")
            if not isinstance(args, list) or len(args) == 0:
                args = [{}]

            ctxmap = args[0]
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            _fixctx(ctx, client)

            err = None
            if len(args) > 1:
                err_map = args[1]
                if isinstance(err_map, dict):
                    err = _err_from_map(err_map)

            # make_error() raises the constructed exception on the default
            # (throw) path. Adapt to the (result, err) shape the runner expects.
            try:
                return utility.make_error(ctx, err), None
            except ZefoyTiktokBotError as e:
                return None, e

        _runset(_get_spec(primary, "makeError", "basic"), subject)

    def test_make_error_no_throw(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.ctrl.throw_err = False
        ctx.result = ZefoyTiktokBotResult({
            "ok": False,
            "resdata": {"id": "safe01"},
        })

        # throw_err is False: make_error returns the bare result data instead
        # of raising (the result-object / no-throw escape hatch).
        out = utility.make_error(ctx, ctx.make_error("test_code", "test message"))
        assert isinstance(out, dict)
        assert out["id"] == "safe01"

    def test_feature_add_basic(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        start_len = len(client.features)

        feature = ZefoyTiktokBotBaseFeature()
        utility.feature_add(ctx, feature)

        assert len(client.features) == start_len + 1

    def test_feature_hook_basic(self):
        hook_client = ZefoyTiktokBotSDK.test(None, None)
        hook_utility = hook_client._utility
        ctx = _make_test_ctx(hook_client, hook_utility)

        state = {"called": False}

        class TestHookFeature(ZefoyTiktokBotBaseFeature):
            def TestHook(self, ctx):
                state["called"] = True

        hook_feature = TestHookFeature()
        hook_client.features = [hook_feature]

        hook_utility.feature_hook(ctx, "TestHook")
        assert state["called"] is True

    def test_feature_init_basic(self):
        init_client = ZefoyTiktokBotSDK.test(None, None)
        init_utility = init_client._utility
        ctx = _make_test_ctx(init_client, init_utility)
        ctx.options["feature"] = {
            "initfeat": {"active": True},
        }

        state = {"called": False}

        class TestInitFeature(ZefoyTiktokBotBaseFeature):
            def __init__(self):
                super().__init__()
                self.name = "initfeat"
                self.active = True

            def init(self, ctx, options):
                state["called"] = True

        feature = TestInitFeature()
        init_utility.feature_init(ctx, feature)
        assert state["called"] is True

    def test_feature_init_inactive(self):
        init_client = ZefoyTiktokBotSDK.test(None, None)
        init_utility = init_client._utility
        ctx = _make_test_ctx(init_client, init_utility)
        ctx.options["feature"] = {
            "nofeat": {"active": False},
        }

        state = {"called": False}

        class TestInitFeatureInactive(ZefoyTiktokBotBaseFeature):
            def __init__(self):
                super().__init__()
                self.name = "nofeat"
                self.active = False

            def init(self, ctx, options):
                state["called"] = True

        feature = TestInitFeatureInactive()
        init_utility.feature_init(ctx, feature)
        assert state["called"] is False

    def test_fetcher_live(self):
        calls = []

        def mock_fetch(url, fetchdef):
            calls.append({"url": url, "init": fetchdef})
            return {"status": 200, "statusText": "OK"}, None

        live_client = ZefoyTiktokBotSDK({
            # Concrete base: a live construction must satisfy any server
            # variables a templated base URL declares; a literal base
            # sidesteps the requirement.
            "base": "http://localhost:8080",
            "system": {
                "fetch": mock_fetch,
            },
        })
        live_utility = live_client._utility
        ctx = live_utility.make_context({
            "opname": "load",
            "client": live_client,
            "utility": live_utility,
        }, None)

        fetchdef = {"method": "GET", "headers": {}}
        _, err = live_utility.fetcher(ctx, "http://example.com/test", fetchdef)
        assert err is None
        assert len(calls) == 1
        assert calls[0]["url"] == "http://example.com/test"

    def test_fetcher_blocked_test_mode(self):
        def mock_fetch(url, fetchdef):
            return {}, None

        blocked_client = ZefoyTiktokBotSDK({
            "base": "http://localhost:8080",
            "system": {
                "fetch": mock_fetch,
            },
        })
        blocked_client.mode = "test"

        blocked_utility = blocked_client._utility
        ctx = blocked_utility.make_context({
            "opname": "load",
            "client": blocked_client,
            "utility": blocked_utility,
        }, None)

        fetchdef = {"method": "GET", "headers": {}}
        _, err = blocked_utility.fetcher(ctx, "http://example.com/test", fetchdef)
        assert err is not None
        assert "blocked" in str(err).lower()

    def test_make_context_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            in_val = entry.get("in")
            if isinstance(in_val, dict):
                ctx = utility.make_context(in_val, None)
                out = {
                    "id": ctx.id,
                }
                if ctx.op is not None:
                    out["op"] = {
                        "name": ctx.op.name,
                        "input": ctx.op.input,
                    }
                return out, None
            return None, None

        _runset(_get_spec(primary, "makeContext", "basic"), subject)

    def test_make_fetch_def_basic(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = ZefoyTiktokBotSpec({
            "base": "http://localhost:8080",
            "prefix": "/api",
            "path": "items/{id}",
            "suffix": "",
            "params": {"id": "item01"},
            "query": {},
            "headers": {"content-type": "application/json"},
            "method": "GET",
            "step": "start",
        })
        ctx.result = ZefoyTiktokBotResult({})

        fetchdef, err = utility.make_fetch_def(ctx)
        assert err is None
        assert fetchdef["method"] == "GET"
        url = fetchdef.get("url", "")
        assert "/api/items/item01" in url
        assert fetchdef["headers"]["content-type"] == "application/json"
        assert fetchdef.get("body") is None

    def test_make_fetch_def_with_body(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = ZefoyTiktokBotSpec({
            "base": "http://localhost:8080",
            "prefix": "",
            "path": "items",
            "suffix": "",
            "params": {},
            "query": {},
            "headers": {},
            "method": "POST",
            "step": "start",
            "body": {"name": "test"},
        })
        ctx.result = ZefoyTiktokBotResult({})

        fetchdef, err = utility.make_fetch_def(ctx)
        assert err is None
        assert fetchdef["method"] == "POST"
        body_str = fetchdef.get("body")
        assert isinstance(body_str, str)
        assert '"name"' in body_str

    def test_make_options_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            in_val = entry.get("in")
            if not isinstance(in_val, dict):
                in_val = {}
            ctx = utility.make_context({
                "options": in_val.get("options"),
                "config": in_val.get("config"),
            }, None)
            ctx.client = client
            ctx.utility = utility
            return utility.make_options(ctx), None

        _runset(_get_spec(primary, "makeOptions", "basic"), subject)

    def test_make_request_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            ctx.options = client.options_map()

            _, err = utility.make_request(ctx)
            if err is not None:
                return None, err

            # Update entry ctx for match checking
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict):
                if ctx.response is not None:
                    entry_ctx["response"] = "exists"
                if ctx.result is not None:
                    entry_ctx["result"] = "exists"

            return None, None

        _runset(_get_spec(primary, "makeRequest", "basic"), subject)

    def test_make_response_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            _fixctx(ctx, client)

            _, err = utility.make_response(ctx)
            if err is not None:
                return None, err

            # Update entry ctx for match with result data
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.result is not None:
                entry_ctx["result"] = {
                    "ok": ctx.result.ok,
                    "status": ctx.result.status,
                    "statusText": ctx.result.status_text,
                    "headers": ctx.result.headers,
                    "body": ctx.result.body,
                }

            return None, None

        _runset(_get_spec(primary, "makeResponse", "basic"), subject)

    def test_make_result_basic(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = ZefoyTiktokBotSpec({
            "base": "http://localhost:8080",
            "prefix": "/api",
            "path": "items/{id}",
            "suffix": "",
            "params": {"id": "item01"},
            "query": {},
            "headers": {},
            "method": "GET",
            "step": "start",
        })
        ctx.result = ZefoyTiktokBotResult({
            "ok": True,
            "status": 200,
            "statusText": "OK",
            "headers": {},
            "resdata": {"id": "item01", "name": "Test"},
        })

        result, err = utility.make_result(ctx)
        assert err is None
        assert result.status == 200

    def test_make_result_no_spec(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = None
        ctx.result = ZefoyTiktokBotResult({
            "ok": True,
            "status": 200,
            "statusText": "OK",
            "headers": {},
        })

        _, err = utility.make_result(ctx)
        assert err is not None

    def test_make_result_no_result(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_full_ctx(client, utility)
        ctx.spec = ZefoyTiktokBotSpec({"step": "start"})
        ctx.result = None

        _, err = utility.make_result(ctx)
        assert err is not None

    def test_make_spec_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        setup_opts = _get_spec(primary, "makeSpec", "DEF", "setup", "a")
        spec_client = ZefoyTiktokBotSDK.test(None, setup_opts)
        spec_utility = spec_client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, spec_client, spec_utility)
            ctx.options = spec_client.options_map()

            _, err = utility.make_spec(ctx)
            if err is not None:
                return None, err

            # Update entry ctx for match
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.spec is not None:
                entry_ctx["spec"] = {
                    "base": ctx.spec.base,
                    "prefix": ctx.spec.prefix,
                    "suffix": ctx.spec.suffix,
                    "method": ctx.spec.method,
                    "params": ctx.spec.params,
                    "query": ctx.spec.query,
                    "headers": ctx.spec.headers,
                    "step": ctx.spec.step,
                }

            return None, None

        _runset(_get_spec(primary, "makeSpec", "basic"), subject)

    def test_make_point_basic(self):
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility
        ctx = _make_test_ctx(client, utility)
        point = {
            "parts": ["items", "{id}"],
            "args": {"params": []},
            "params": [],
            "alias": {},
            "select": {},
            "active": True,
            "transform": {},
        }
        ctx.op.points = [point]

        _, err = utility.make_point(ctx)
        assert err is None
        assert ctx.point is not None

    def test_make_url_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            if ctx.result is None:
                ctx.result = ZefoyTiktokBotResult({})
            return utility.make_url(ctx)

        _runset(_get_spec(primary, "makeUrl", "basic"), subject)

    def test_operator_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")

        def subject(entry):
            in_val = entry.get("in")
            if not isinstance(in_val, dict):
                in_val = {}
            op = ZefoyTiktokBotOperation(in_val)
            return {
                "entity": op.entity,
                "name": op.name,
                "input": op.input,
                "points": op.points,
            }, None

        _runset(_get_spec(primary, "operator", "basic"), subject)

    def test_param_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            args = entry.get("args")
            if not isinstance(args, list) or len(args) < 2:
                return None, None

            ctxmap = args[0]
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            paramdef = args[1]

            result = utility.param(ctx, paramdef)

            # Update entry ctx for match
            match_spec = entry.get("match")
            if isinstance(match_spec, dict):
                ctx_match = match_spec.get("ctx")
                if isinstance(ctx_match, dict):
                    entry_ctx = entry.get("ctx")
                    if entry_ctx is None:
                        entry_ctx = {}
                        entry["ctx"] = entry_ctx
                    # Copy spec alias back to entry ctx for matching
                    spec_match = ctx_match.get("spec")
                    if isinstance(spec_match, dict):
                        if ctx.spec is not None:
                            if entry_ctx.get("spec") is None:
                                entry_ctx["spec"] = {}
                            alias_match = spec_match.get("alias")
                            if isinstance(alias_match, dict):
                                entry_ctx["spec"] = {
                                    "alias": ctx.spec.alias,
                                }

            return result, None

        _runset(_get_spec(primary, "param", "basic"), subject)

    def test_prepare_auth_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        setup_opts = _get_spec(primary, "prepareAuth", "DEF", "setup", "a")
        auth_client = ZefoyTiktokBotSDK.test(None, setup_opts)
        auth_utility = auth_client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, auth_client, auth_utility)
            _fixctx(ctx, auth_client)

            _, err = utility.prepare_auth(ctx)
            if err is not None:
                return None, err

            # Update entry ctx for match
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.spec is not None:
                entry_ctx["spec"] = {
                    "headers": ctx.spec.headers,
                }

            return None, None

        _runset(_get_spec(primary, "prepareAuth", "basic"), subject)

    def test_prepare_body_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            _fixctx(ctx, client)
            return utility.prepare_body(ctx), None

        _runset(_get_spec(primary, "prepareBody", "basic"), subject)

    def test_prepare_headers_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            return utility.prepare_headers(ctx), None

        _runset(_get_spec(primary, "prepareHeaders", "basic"), subject)

    def test_prepare_method_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            return utility.prepare_method(ctx), None

        _runset(_get_spec(primary, "prepareMethod", "basic"), subject)

    def test_prepare_params_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            return utility.prepare_params(ctx), None

        _runset(_get_spec(primary, "prepareParams", "basic"), subject)

    def test_prepare_path_basic(self):
        # Was two hand-written cases that had drifted out of the shared corpus
        # (the preparePath fixture shipped as an empty `set: []`). Now driven
        # by the corpus like every other section, so all ports assert the same
        # separator / blank-segment behaviour.
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            return utility.prepare_path(ctx), None

        _runset(_get_spec(primary, "preparePath", "basic"), subject)

    def test_prepare_query_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            return utility.prepare_query(ctx), None

        _runset(_get_spec(primary, "prepareQuery", "basic"), subject)

    def test_result_basic_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)
            _fixctx(ctx, client)

            result = utility.result_basic(ctx)

            out = {
                "status": result.status,
                "statusText": result.status_text,
            }
            if result.err is not None:
                out["err"] = {
                    "message": str(result.err),
                }

            return out, None

        _runset(_get_spec(primary, "resultBasic", "basic"), subject)

    def test_result_body_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)

            utility.result_body(ctx)

            # Update entry ctx for match
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.result is not None:
                entry_ctx["result"] = {
                    "body": ctx.result.body,
                }

            return None, None

        _runset(_get_spec(primary, "resultBody", "basic"), subject)

    def test_result_headers_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)

            utility.result_headers(ctx)

            # Update entry ctx for match
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.result is not None:
                entry_ctx["result"] = {
                    "headers": ctx.result.headers,
                }

            return None, None

        _runset(_get_spec(primary, "resultHeaders", "basic"), subject)

    def test_transform_request_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)

            result = utility.transform_request(ctx)

            # Update entry ctx for match (step changed)
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.spec is not None:
                spec_map = entry_ctx.get("spec")
                if isinstance(spec_map, dict):
                    spec_map["step"] = ctx.spec.step

            return result, None

        _runset(_get_spec(primary, "transformRequest", "basic"), subject)

    def test_transform_response_basic(self):
        spec = _load_test_spec()
        primary = _get_spec(spec, "primary")
        client = ZefoyTiktokBotSDK.test(None, None)
        utility = client._utility

        def subject(entry):
            ctxmap = entry.get("ctx")
            if not isinstance(ctxmap, dict):
                ctxmap = {}
            ctx = _make_ctx_from_map(ctxmap, client, utility)

            result = utility.transform_response(ctx)

            # Update entry ctx for match (step changed)
            entry_ctx = entry.get("ctx")
            if isinstance(entry_ctx, dict) and ctx.spec is not None:
                spec_map = entry_ctx.get("spec")
                if isinstance(spec_map, dict):
                    spec_map["step"] = ctx.spec.step

            return result, None

        _runset(_get_spec(primary, "transformResponse", "basic"), subject)
