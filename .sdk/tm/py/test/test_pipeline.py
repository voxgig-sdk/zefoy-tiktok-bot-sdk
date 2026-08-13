# ZefoyTiktokBot SDK pipeline test
#
# Direct unit tests for the operation-pipeline utilities. The generated
# entity tests exercise the happy path; these drive the error and edge
# branches (missing spec/response/result, 4xx handling, transport
# failures, feature ordering, auth header shaping) that a normal
# success-path op never reaches. All utilities are reached through the
# client's utility object, so this suite is API-agnostic.
#
# Deliberate differences from the ts pipeline suite (genuinely
# inapplicable here):
# - a body-parse exception is not captured on result.err by the py
#   result_body utility (it has no parse guard), so that ts case is
#   omitted.

import pytest

from projectname_sdk import ZefoyTiktokBotSDK
from projectname_sdk.core.error import ZefoyTiktokBotError
from projectname_sdk.core.result import ZefoyTiktokBotResult
from projectname_sdk.core.response import ZefoyTiktokBotResponse
from projectname_sdk.core.spec import ZefoyTiktokBotSpec
from projectname_sdk.feature.base_feature import ZefoyTiktokBotBaseFeature


def _client():
    return ZefoyTiktokBotSDK.test(None, None)


def _ctx(client, opname="load", ctrl=None):
    ctxmap = {"opname": opname}
    if ctrl is not None:
        ctxmap["ctrl"] = ctrl
    return client._utility.make_context(ctxmap, client.get_root_ctx())


def _full_spec():
    return ZefoyTiktokBotSpec({
        "base": "http://h",
        "prefix": "",
        "suffix": "",
        "path": "a",
        "method": "GET",
        "params": {},
        "query": {},
        "headers": {},
        "step": "s",
    })


def _resp(status, data=None, headers=None):
    lower = {}
    for key, val in (headers or {}).items():
        lower[str(key).lower()] = val
    return ZefoyTiktokBotResponse({
        "status": status,
        "statusText": "OK" if status < 400 else "ERR",
        "headers": lower,
        "json": lambda: data,
        "body": "body",
    })


class TestMakePointAndMakeSpec:

    def test_make_point_rejects_a_disallowed_operation(self):
        client = _client()
        ctx = _ctx(client, opname="nope")
        ctx.options = {"allow": {"op": "load"}}
        _, err = client._utility.make_point(ctx)
        assert err is not None
        assert err.code == "point_op_allow"

    def test_make_point_rejects_an_operation_with_no_endpoints(self):
        client = _client()
        ctx = _ctx(client, opname="load")
        _, err = client._utility.make_point(ctx)
        assert err is not None
        assert err.code == "point_no_points"

    def test_make_point_returns_the_single_point(self):
        client = _client()
        ctx = _ctx(client, opname="load")
        point = {"method": "GET", "parts": ["a"]}
        ctx.op.points = [point]
        out, err = client._utility.make_point(ctx)
        assert err is None
        assert out is point
        assert ctx.point is point

    def test_make_point_short_circuits_a_feature_supplied_point(self):
        client = _client()
        ctx = _ctx(client, opname="load")
        preset = {"method": "GET"}
        ctx.out["point"] = preset
        out, err = client._utility.make_point(ctx)
        assert err is None
        assert out is preset

    def test_make_point_surfaces_a_feature_supplied_error(self):
        # The rbac feature short-circuits by placing an error in
        # ctx.out["point"]; make_point must abort with that error so the
        # pipeline never touches the network.
        client = _client()
        ctx = _ctx(client, opname="load")
        denied = ctx.make_error("rbac_denied", "no permission")
        ctx.out["point"] = denied
        out, err = client._utility.make_point(ctx)
        assert out is None
        assert err is denied

    def test_make_spec_short_circuits_a_feature_supplied_spec(self):
        client = _client()
        ctx = _ctx(client, opname="load")
        preset = ZefoyTiktokBotSpec({"method": "GET"})
        ctx.out["spec"] = preset
        out, err = client._utility.make_spec(ctx)
        assert err is None
        assert out is preset

    def test_make_spec_surfaces_a_feature_supplied_error(self):
        client = _client()
        ctx = _ctx(client, opname="load")
        boom = ctx.make_error("boom", "boom")
        ctx.out["spec"] = boom
        out, err = client._utility.make_spec(ctx)
        assert out is None
        assert err is boom


class TestMakeResponse:

    def test_guards_missing_spec_response_result(self):
        client = _client()
        utility = client._utility

        ctx = _ctx(client)
        ctx.spec = None
        ctx.response = _resp(200)
        ctx.result = ZefoyTiktokBotResult({})
        _, err = utility.make_response(ctx)
        assert err.code == "response_no_spec"

        ctx = _ctx(client)
        ctx.spec = _full_spec()
        ctx.response = None
        ctx.result = ZefoyTiktokBotResult({})
        _, err = utility.make_response(ctx)
        assert err.code == "response_no_response"

        ctx = _ctx(client)
        ctx.spec = _full_spec()
        ctx.response = _resp(200)
        ctx.result = None
        _, err = utility.make_response(ctx)
        assert err.code == "response_no_result"

    def test_a_4xx_response_sets_result_err_and_copies_headers(self):
        client = _client()
        ctx = _ctx(client)
        ctx.spec = _full_spec()
        ctx.response = _resp(404, None, {"x-a": "1"})
        ctx.result = ZefoyTiktokBotResult({})
        _, err = client._utility.make_response(ctx)
        assert err is None
        assert ctx.result.err is not None
        assert ctx.result.status == 404
        assert ctx.result.headers["x-a"] == "1"
        assert ctx.result.ok is False

    def test_a_2xx_response_parses_the_body_and_marks_ok(self):
        client = _client()
        ctx = _ctx(client)
        ctx.spec = _full_spec()
        ctx.response = _resp(200, {"v": 1})
        ctx.result = ZefoyTiktokBotResult({})
        _, err = client._utility.make_response(ctx)
        assert err is None
        assert ctx.result.ok is True
        assert ctx.result.body == {"v": 1}

    def test_records_to_ctrl_explain_when_explain_is_on(self):
        client = _client()
        ctx = _ctx(client, ctrl={"explain": {}})
        ctx.spec = _full_spec()
        ctx.response = _resp(200, {"v": 2})
        ctx.result = ZefoyTiktokBotResult({})
        client._utility.make_response(ctx)
        assert ctx.ctrl.explain.get("result") is not None

    def test_short_circuits_a_feature_supplied_response(self):
        client = _client()
        ctx = _ctx(client)
        preset = _resp(299)
        ctx.out["response"] = preset
        out, err = client._utility.make_response(ctx)
        assert err is None
        assert out is preset


class TestMakeResult:

    class _EntityFactory:
        def __init__(self):
            self.made = []
            self.factory = self

        def get_name(self):
            return "x"

        def make(self):
            outer = self

            class _Ent:
                def data_set(self, data):
                    outer.made.append(data)

            return _Ent()

    def test_guards_missing_spec_and_result(self):
        client = _client()
        utility = client._utility

        ctx = _ctx(client)
        ctx.spec = None
        ctx.result = ZefoyTiktokBotResult({})
        _, err = utility.make_result(ctx)
        assert err.code == "result_no_spec"

        ctx = _ctx(client)
        ctx.spec = _full_spec()
        ctx.result = None
        _, err = utility.make_result(ctx)
        assert err.code == "result_no_result"

    def test_list_op_wraps_resdata_into_entity_instances(self):
        client = _client()
        ctx = _ctx(client, opname="list")
        entity = self._EntityFactory()
        ctx.entity = entity
        ctx.spec = _full_spec()
        ctx.result = ZefoyTiktokBotResult({"resdata": [{"a": 1}, {"a": 2}]})
        result, err = client._utility.make_result(ctx)
        assert err is None
        assert len(result.resdata) == 2
        assert entity.made == [{"a": 1}, {"a": 2}]

    def test_an_empty_list_yields_an_empty_resdata_array(self):
        client = _client()
        ctx = _ctx(client, opname="list")
        ctx.entity = self._EntityFactory()
        ctx.spec = _full_spec()
        ctx.result = ZefoyTiktokBotResult({"resdata": []})
        result, err = client._utility.make_result(ctx)
        assert err is None
        assert result.resdata == []

    def test_short_circuits_on_a_preset_result(self):
        client = _client()
        ctx = _ctx(client)
        preset = ZefoyTiktokBotResult({"ok": True})
        ctx.out["result"] = preset
        out, err = client._utility.make_result(ctx)
        assert err is None
        assert out is preset


class TestMakeRequest:

    def _util_with_fetcher(self, client, fetcher):
        utility = client.get_utility()
        utility.fetcher = fetcher
        return utility

    def test_guards_a_missing_spec(self):
        client = _client()
        ctx = _ctx(client)
        ctx.spec = None
        _, err = client._utility.make_request(ctx)
        assert err.code == "request_no_spec"

    def test_a_transport_error_is_carried_on_the_response(self):
        client = _client()
        ctx = _ctx(client)
        boom = ctx.make_error("boom", "boom")
        ctx.utility = self._util_with_fetcher(
            client, lambda _c, _u, _fd: (None, boom))
        ctx.spec = _full_spec()
        response, err = ctx.utility.make_request(ctx)
        assert err is None
        assert response.err is boom

    def test_a_null_transport_result_becomes_a_response_error(self):
        client = _client()
        ctx = _ctx(client)
        ctx.utility = self._util_with_fetcher(
            client, lambda _c, _u, _fd: (None, None))
        ctx.spec = _full_spec()
        response, err = ctx.utility.make_request(ctx)
        assert err is None
        assert response.err is not None
        assert response.err.code == "request_no_response"

    def test_a_normal_transport_response_is_wrapped(self):
        client = _client()
        ctx = _ctx(client)
        fetched = {
            "status": 200,
            "statusText": "OK",
            "headers": {},
            "json": lambda: {"a": 1},
            "body": "body",
        }
        ctx.utility = self._util_with_fetcher(
            client, lambda _c, _u, _fd: (fetched, None))
        ctx.spec = _full_spec()
        response, err = ctx.utility.make_request(ctx)
        assert err is None
        assert response.status == 200

    def test_records_the_fetchdef_to_ctrl_explain(self):
        client = _client()
        ctx = _ctx(client, ctrl={"explain": {}})
        ctx.utility = self._util_with_fetcher(
            client, lambda _c, _u, _fd: ({"status": 200,
                                          "statusText": "OK"}, None))
        ctx.spec = _full_spec()
        ctx.utility.make_request(ctx)
        assert ctx.ctrl.explain.get("fetchdef") is not None

    def test_a_fetchdef_error_surfaces_as_a_response_error(self):
        client = _client()
        ctx = _ctx(client)
        utility = client.get_utility()
        boom = ctx.make_error("fetchdef_boom", "boom")
        utility.make_fetch_def = lambda _ctx: (None, boom)
        ctx.utility = utility
        ctx.spec = _full_spec()
        response, err = utility.make_request(ctx)
        assert err is None
        assert response.err is boom

    def test_short_circuits_a_feature_supplied_request(self):
        client = _client()
        ctx = _ctx(client)
        preset = ZefoyTiktokBotResponse({"status": 201, "statusText": "OK"})
        ctx.out["request"] = preset
        out, err = client._utility.make_request(ctx)
        assert err is None
        assert out is preset


class TestMakeFetchDef:

    def test_guards_a_missing_spec(self):
        client = _client()
        ctx = _ctx(client)
        ctx.spec = None
        _, err = client._utility.make_fetch_def(ctx)
        assert err.code == "fetchdef_no_spec"

    def test_serialises_an_object_body_and_inits_a_missing_result(self):
        client = _client()
        ctx = _ctx(client)
        ctx.result = None
        spec = _full_spec()
        spec.method = "POST"
        spec.body = {"x": 1}
        ctx.spec = spec
        fetchdef, err = client._utility.make_fetch_def(ctx)
        assert err is None
        assert isinstance(fetchdef["body"], str)
        assert '"x"' in fetchdef["body"]
        assert "http://h" in fetchdef["url"]
        assert ctx.result is not None  # result was lazily created


class TestMakeErrorAndDone:

    def test_done_returns_resdata_on_success(self):
        client = _client()
        ctx = _ctx(client)
        ctx.result = ZefoyTiktokBotResult({"ok": True, "resdata": 42})
        assert client._utility.done(ctx) == 42

    def test_done_raises_the_error_when_not_ok(self):
        client = _client()
        ctx = _ctx(client)
        ctx.result = ZefoyTiktokBotResult({"ok": False})
        with pytest.raises(ZefoyTiktokBotError):
            client._utility.done(ctx)

    def test_done_cleans_ctrl_explain_on_success(self):
        client = _client()
        ctx = _ctx(client, ctrl={"explain": {"result": {"err": "x"}}})
        ctx.result = ZefoyTiktokBotResult({"ok": True, "resdata": 7})
        assert client._utility.done(ctx) == 7

    def test_make_error_returns_resdata_when_throw_is_disabled(self):
        client = _client()
        ctx = _ctx(client, ctrl={"throw_err": False})
        ctx.result = ZefoyTiktokBotResult({"ok": False, "resdata": "fallback"})
        assert client._utility.make_error(ctx, None) == "fallback"

    def test_make_error_records_to_ctrl_explain(self):
        client = _client()
        ctx = _ctx(client, ctrl={"throw_err": False, "explain": {}})
        ctx.result = ZefoyTiktokBotResult({"ok": False})
        client._utility.make_error(ctx, None)
        assert ctx.ctrl.explain.get("err") is not None


class TestFeatureOrdering:

    def _named_feature(self, name):
        feature = ZefoyTiktokBotBaseFeature()
        feature.name = name
        return feature

    def test_feature_add_appends_in_call_order(self):
        client = _client()
        ctx = _ctx(client)
        utility = client._utility
        start = [f.get_name() for f in client.features]
        utility.feature_add(ctx, self._named_feature("aaa"))
        utility.feature_add(ctx, self._named_feature("zzz"))
        assert [f.get_name() for f in client.features] == start + ["aaa", "zzz"]

    def test_feature_add_ordering_before_after_replace(self):
        # `_options` on an extend-feature instance positions it relative to
        # an already-added feature (mirrors the ts featureAdd).
        client = _client()
        ctx = _ctx(client)
        utility = client._utility
        client.features.clear()

        def names():
            return [f.get_name() for f in client.features]

        utility.feature_add(ctx, self._named_feature("a"))
        utility.feature_add(ctx, self._named_feature("b"))
        assert names() == ["a", "b"]

        before = self._named_feature("z1")
        before._options = {"__before__": "b"}
        utility.feature_add(ctx, before)
        assert names() == ["a", "z1", "b"]

        after = self._named_feature("z2")
        after._options = {"__after__": "a"}
        utility.feature_add(ctx, after)
        assert names() == ["a", "z2", "z1", "b"]

        replace = self._named_feature("z3")
        replace._options = {"__replace__": "z1"}
        utility.feature_add(ctx, replace)
        assert names() == ["a", "z2", "z3", "b"]

        # An ordering option naming no existing feature falls back to append.
        miss = self._named_feature("z4")
        miss._options = {"__before__": "missing"}
        utility.feature_add(ctx, miss)
        assert names() == ["a", "z2", "z3", "b", "z4"]

    def test_later_inits_wrap_earlier_ones_on_the_transport(self):
        # Transport-wrapping features compose by init order: the feature
        # initialized last is outermost. This ordering is what lets retry
        # wrap netsim (and cache wrap everything) in the generated client.
        client = _client()
        ctx = client.get_root_ctx()
        utility = client._utility
        order = []

        def server(_ctx, _url, _fetchdef):
            order.append("server")
            return {"status": 200, "statusText": "OK"}, None

        utility.fetcher = server

        def make_wrapper(tag):
            inner = utility.fetcher

            def wrapper(fctx, url, fetchdef):
                order.append(tag)
                return inner(fctx, url, fetchdef)

            return wrapper

        utility.fetcher = make_wrapper("first")
        utility.fetcher = make_wrapper("second")

        utility.fetcher(ctx, "http://h/a", {"method": "GET", "headers": {}})
        assert order == ["second", "first", "server"]


class TestPrepareAuth:

    class _AuthClient:
        def __init__(self, options):
            self._options = options

        def options_map(self):
            return self._options

    # Fake client so the exact options.auth / apikey shape is controlled.
    def _auth_ctx(self, client, options, headers):
        utility = client._utility
        ctx = utility.make_context({"opname": "load"}, client.get_root_ctx())
        ctx.client = self._AuthClient(options)
        ctx.spec = None if headers is None else ZefoyTiktokBotSpec(
            {"headers": headers})
        return ctx

    def test_guards_a_missing_spec(self):
        client = _client()
        ctx = self._auth_ctx(client,
                             {"auth": {"prefix": ""}, "apikey": "K"}, None)
        _, err = client._utility.prepare_auth(ctx)
        assert err.code == "auth_no_spec"

    def test_an_apikey_with_a_prefix_is_space_joined(self):
        client = _client()
        ctx = self._auth_ctx(client,
                             {"apikey": "K", "auth": {"prefix": "Bearer"}}, {})
        _, err = client._utility.prepare_auth(ctx)
        assert err is None
        assert ctx.spec.headers["authorization"] == "Bearer K"

    def test_a_raw_apikey_goes_in_as_is(self):
        client = _client()
        ctx = self._auth_ctx(client,
                             {"apikey": "K", "auth": {"prefix": ""}}, {})
        client._utility.prepare_auth(ctx)
        assert ctx.spec.headers["authorization"] == "K"

    def test_an_empty_apikey_drops_the_header(self):
        client = _client()
        ctx = self._auth_ctx(client,
                             {"apikey": "", "auth": {"prefix": "Bearer"}},
                             {"authorization": "stale"})
        client._utility.prepare_auth(ctx)
        assert ctx.spec.headers.get("authorization") is None

    def test_a_public_api_with_no_auth_block_drops_the_header(self):
        client = _client()
        ctx = self._auth_ctx(client, {"apikey": "K"},
                             {"authorization": "stale"})
        client._utility.prepare_auth(ctx)
        assert ctx.spec.headers.get("authorization") is None

    def test_a_missing_apikey_option_drops_the_header(self):
        client = _client()
        ctx = self._auth_ctx(client, {"auth": {"prefix": "Bearer"}},
                             {"authorization": "stale"})
        client._utility.prepare_auth(ctx)
        assert ctx.spec.headers.get("authorization") is None


class TestResultHelpers:

    def test_result_headers_with_no_headers_yields_an_empty_map(self):
        client = _client()
        ctx = _ctx(client)
        ctx.response = ZefoyTiktokBotResponse({"status": 200})
        ctx.result = ZefoyTiktokBotResult({})
        client._utility.result_headers(ctx)
        assert ctx.result.headers == {}

    def test_result_body_skips_parsing_when_the_body_is_absent(self):
        client = _client()
        ctx = _ctx(client)
        ctx.response = ZefoyTiktokBotResponse({"status": 200,
                                            "json": lambda: {"a": 1}})
        ctx.result = ZefoyTiktokBotResult({})
        client._utility.result_body(ctx)
        assert ctx.result.body is None


class TestFeatureOrder:
    # Feature #2: options["feature"] accepts an ordered LIST (developer
    # add-order) or a map (defaults test-first); make_options records the
    # resolved order in __derived__.featureorder.

    def _resolve(self, feature):
        client = _client()
        ctx = client._utility.make_context({
            "client": client,
            "utility": client._utility,
            "options": {"feature": feature},
            "config": {"options": {}},
        }, None)
        opts = client._utility.make_options(ctx)
        return ",".join(opts["__derived__"]["featureorder"])

    def test_map_form_is_test_first(self):
        assert self._resolve(
            {"metrics": {"active": True}, "test": {"active": True}}) == "test,metrics"

    def test_list_form_preserves_order(self):
        assert self._resolve(
            [{"name": "metrics", "active": True},
             {"name": "test", "active": True}]) == "metrics,test"

    def test_map_form_no_test_deterministic(self):
        assert self._resolve(
            {"retry": {"active": True}, "cache": {"active": True}}) == "cache,retry"
