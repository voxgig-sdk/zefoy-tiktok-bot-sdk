# ZefoyTiktokBot SDK feature tests
#
# Behavioural + coverage tests for the enterprise features shipped with
# this SDK. Each block runs only when its feature is present (see
# has_feature), driving the real generated feature class through the
# offline harness pipeline against a simulated network.

import re
import time

import pytest

from test.feature_harness import (
    has_feature,
    make_client,
    make_clock,
    make_response,
    recording_server,
)


def test_at_least_the_test_feature_is_present():
    assert has_feature("test") is True


# --- netsim -----------------------------------------------------------------
@pytest.mark.skipif(not has_feature("netsim"), reason="netsim not in this SDK")
class TestNetsimFeature:

    def test_fixed_latency_then_delegate(self):
        clock = make_clock()
        h = make_client([{"name": "netsim",
                          "options": {"latency": 250, "sleep": clock.sleep}}])
        res = h.op(op="load", ctrl={"explain": {}})
        assert res["ok"] is True
        assert clock.time == 250
        assert h.client._netsim["calls"] == 1

    def test_ranged_latency_samples_within_min_max(self):
        clock = make_clock()
        h = make_client([{"name": "netsim",
                          "options": {"latency": {"min": 100, "max": 300},
                                      "seed": 7, "sleep": clock.sleep}}])
        h.op(op="load")
        assert 100 <= clock.time < 300

    def test_equal_min_max_latency_is_exact(self):
        clock = make_clock()
        h = make_client([{"name": "netsim",
                          "options": {"latency": {"min": 50, "max": 50},
                                      "sleep": clock.sleep}}])
        h.op(op="load")
        assert clock.time == 50

    def test_fail_times_returns_a_retryable_status(self):
        h = make_client([{"name": "netsim",
                          "options": {"failTimes": 2, "failStatus": 503}}])
        assert h.op(op="load")["result"].status == 503
        assert h.op(op="load")["result"].status == 503
        assert h.op(op="load")["ok"] is True

    def test_fail_every_fails_every_nth_call(self):
        h = make_client([{"name": "netsim", "options": {"failEvery": 2}}])
        assert h.op(op="load")["ok"] is True
        assert h.op(op="load")["ok"] is False
        assert h.op(op="load")["ok"] is True

    def test_fail_rate_with_a_seed_is_deterministic(self):
        h = make_client([{"name": "netsim",
                          "options": {"failRate": 1, "seed": 5}}])
        assert h.op(op="load")["ok"] is False

    def test_error_times_yields_a_connection_error(self):
        h = make_client([{"name": "netsim", "options": {"errorTimes": 1}}])
        assert h.op(op="load")["error"].code == "netsim_conn"

    def test_offline_fails_every_call(self):
        h = make_client([{"name": "netsim", "options": {"offline": True}}])
        assert h.op(op="load")["error"].code == "netsim_offline"

    def test_rate_limit_times_returns_429_and_retry_after(self):
        h = make_client([{"name": "netsim",
                          "options": {"rateLimitTimes": 1, "retryAfter": 3}}])
        res = h.op(op="load")
        assert res["result"].status == 429
        assert res["result"].headers["retry-after"] == "3"

    def test_inactive_netsim_does_not_wrap(self):
        h = make_client([{"name": "netsim", "options": {"active": False}}])
        assert h.op(op="load")["ok"] is True
        assert getattr(h.client, "_netsim", None) is None

    def test_no_latency_option_delays_nothing(self):
        h = make_client([{"name": "netsim", "options": {}}])
        assert h.op(op="load")["ok"] is True

    def test_real_timer_latency_actually_waits(self):
        h = make_client([{"name": "netsim", "options": {"latency": 15}}])
        start = time.time()
        h.op(op="load")
        assert (time.time() - start) * 1000 >= 8


# --- retry ------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("retry"), reason="retry not in this SDK")
class TestRetryFeature:

    def test_retries_transient_failures_then_succeeds(self):
        clock = make_clock()
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 2, "failStatus": 503}},
            {"name": "retry", "options": {"retries": 3, "minDelay": 10,
                                          "jitter": False, "sleep": clock.sleep}},
        ])
        assert h.op(op="load")["ok"] is True
        assert h.client._retry["attempts"] == 2

    def test_gives_up_after_the_budget(self):
        clock = make_clock()
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 9, "failStatus": 500}},
            {"name": "retry", "options": {"retries": 2, "minDelay": 1,
                                          "jitter": False, "sleep": clock.sleep}},
        ])
        assert h.op(op="load")["result"].status == 500

    def test_does_not_retry_a_non_retryable_status(self):
        server, calls = recording_server(lambda _n, _fd: make_response(404))
        h = make_client([{"name": "retry",
                          "options": {"retries": 3, "minDelay": 0}}],
                        server=server)
        h.op(op="load")
        assert len(calls) == 1

    def test_retries_a_raised_transport_error_then_reraises(self):
        clock = make_clock()
        state = {"n": 0}

        def server(_ctx, _url, _fetchdef):
            state["n"] += 1
            raise RuntimeError("boom")

        h = make_client([{"name": "retry",
                          "options": {"retries": 2, "minDelay": 1,
                                      "jitter": False, "sleep": clock.sleep}}],
                        server=server)
        res = h.op(op="load")
        assert res["ok"] is False
        assert state["n"] == 3

    def test_retries_a_transport_error_result(self):
        state = {"n": 0}

        def server(ctx, _url, _fetchdef):
            state["n"] += 1
            if state["n"] < 2:
                return None, ctx.make_error("conn", "connection lost")
            return make_response(200, {"ok": True}), None

        h = make_client([{"name": "retry",
                          "options": {"retries": 3, "minDelay": 0}}],
                        server=server)
        assert h.op(op="load")["ok"] is True
        assert state["n"] == 2

    def test_honours_a_server_retry_after(self):
        clock = make_clock()
        h = make_client([
            {"name": "netsim", "options": {"rateLimitTimes": 1, "retryAfter": 2}},
            {"name": "retry", "options": {"retries": 2, "minDelay": 10,
                                          "maxDelay": 60000, "jitter": False,
                                          "sleep": clock.sleep}},
        ])
        assert h.op(op="load")["ok"] is True
        assert clock.time == 2000

    def test_default_jitter_path_still_succeeds(self):
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1}},
            {"name": "retry", "options": {"retries": 2, "minDelay": 0}},
        ])
        assert h.op(op="load")["ok"] is True

    def test_non_numeric_status_is_not_retryable(self):
        server, calls = recording_server(lambda _n, _fd: {
            "status": "weird", "json": lambda: {}, "headers": {}})
        h = make_client([{"name": "retry",
                          "options": {"retries": 3, "minDelay": 0}}],
                        server=server)
        h.op(op="load")
        assert len(calls) == 1

    def test_inactive_retry_does_not_wrap(self):
        server, calls = recording_server(lambda _n, _fd: make_response(503))
        h = make_client([{"name": "retry", "options": {"active": False}}],
                        server=server)
        h.op(op="load")
        assert len(calls) == 1


# --- timeout ----------------------------------------------------------------
@pytest.mark.skipif(not has_feature("timeout"), reason="timeout not in this SDK")
class TestTimeoutFeature:

    def test_a_slow_request_times_out(self):
        clock = make_clock()
        h = make_client([
            {"name": "netsim", "options": {"latency": 80, "sleep": clock.sleep}},
            {"name": "timeout", "options": {"ms": 10, "now": clock.now}},
        ])
        res = h.op(op="load")
        assert res["error"].code == "timeout"
        assert h.client._timeout["count"] == 1

    def test_a_fast_request_passes_through(self):
        h = make_client([{"name": "timeout", "options": {"ms": 1000}}])
        assert h.op(op="load")["ok"] is True

    def test_ms_zero_or_less_disables_the_timeout(self):
        h = make_client([{"name": "timeout", "options": {"ms": 0}}])
        assert h.op(op="load")["ok"] is True

    def test_annotates_the_fetch_definition_with_a_timeout(self):
        server, calls = recording_server()
        h = make_client([{"name": "timeout", "options": {"ms": 5000}}],
                        server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"]["timeout"] == 5.0

    def test_inactive_timeout_does_not_wrap(self):
        server, calls = recording_server()
        h = make_client([{"name": "timeout", "options": {"active": False}}],
                        server=server)
        h.op(op="load")
        assert "timeout" not in calls[0]["fetchdef"]


# --- ratelimit ----------------------------------------------------------------
@pytest.mark.skipif(not has_feature("ratelimit"),
                    reason="ratelimit not in this SDK")
class TestRatelimitFeature:

    def test_throttles_once_the_burst_is_spent(self):
        clock = make_clock()
        h = make_client([{"name": "ratelimit",
                          "options": {"rate": 1, "burst": 2,
                                      "now": clock.now, "sleep": clock.sleep}}])
        h.op(op="load")
        h.op(op="load")
        h.op(op="load")
        assert h.client._ratelimit["throttled"] == 1
        assert clock.time > 0

    def test_burst_defaults_to_rate_and_refills_over_time(self):
        clock = make_clock()
        h = make_client([{"name": "ratelimit",
                          "options": {"rate": 2,
                                      "now": clock.now, "sleep": clock.sleep}}])
        h.op(op="load")
        h.op(op="load")
        clock.advance(1000)  # refill
        h.op(op="load")
        track = getattr(h.client, "_ratelimit", None)
        assert (0 if track is None else track["throttled"]) == 0

    def test_inactive_ratelimit_does_not_wrap(self):
        h = make_client([{"name": "ratelimit", "options": {"active": False}}])
        assert h.op(op="load")["ok"] is True
        assert getattr(h.client, "_ratelimit", None) is None


# --- cache --------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("cache"), reason="cache not in this SDK")
class TestCacheFeature:

    def test_serves_a_repeated_read_from_cache(self):
        server, calls = recording_server()
        h = make_client([{"name": "cache", "options": {"ttl": 10000}}],
                        server=server)
        a = h.op(op="load", path="/w/1")
        b = h.op(op="load", path="/w/1")
        assert len(calls) == 1
        assert a["data"] == b["data"]
        assert h.client._cache["hit"] == 1

    def test_does_not_cache_non_get(self):
        server, calls = recording_server()
        h = make_client([{"name": "cache"}], server=server)
        h.op(op="create", path="/w")
        h.op(op="create", path="/w")
        assert len(calls) == 2

    def test_does_not_cache_a_non_2xx(self):
        server, calls = recording_server(lambda _n, _fd: make_response(500))
        h = make_client([{"name": "cache"}], server=server)
        h.op(op="load", path="/w")
        h.op(op="load", path="/w")
        assert len(calls) == 2
        assert h.client._cache["bypass"] == 2

    def test_refetches_after_the_ttl(self):
        clock = make_clock()
        server, calls = recording_server()
        h = make_client([{"name": "cache",
                          "options": {"ttl": 1000, "now": clock.now}}],
                        server=server)
        h.op(op="load", path="/w")
        clock.advance(1500)
        h.op(op="load", path="/w")
        assert len(calls) == 2

    def test_evicts_the_oldest_entry_past_max(self):
        server, calls = recording_server()
        h = make_client([{"name": "cache",
                          "options": {"ttl": 10000, "max": 1}}],
                        server=server)
        h.op(op="load", path="/a")
        h.op(op="load", path="/b")  # evicts /a
        h.op(op="load", path="/a")  # miss again
        assert len(calls) == 3

    def test_replayed_body_is_rereadable(self):
        server, calls = recording_server(
            lambda _n, _fd: make_response(200, {"v": 1}))
        h = make_client([{"name": "cache", "options": {"ttl": 10000}}],
                        server=server)
        res = h.op(op="load", path="/w")
        json_func = res["ctx"].response["json"]
        assert json_func() == {"v": 1}
        assert json_func() == {"v": 1}

    def test_inactive_cache_does_not_wrap(self):
        server, calls = recording_server()
        h = make_client([{"name": "cache", "options": {"active": False}}],
                        server=server)
        h.op(op="load", path="/x")
        h.op(op="load", path="/x")
        assert len(calls) == 2


# --- idempotency ----------------------------------------------------------------
@pytest.mark.skipif(not has_feature("idempotency"),
                    reason="idempotency not in this SDK")
class TestIdempotencyFeature:

    def test_adds_a_key_to_mutating_ops(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency"}], server=server)
        h.op(op="create", path="/w")
        assert calls[0]["fetchdef"]["headers"].get("Idempotency-Key") is not None

    def test_adds_a_key_based_on_http_method(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency"}], server=server)
        h.op(op="act", method="PUT", path="/w")
        assert calls[0]["fetchdef"]["headers"].get("Idempotency-Key") is not None

    def test_leaves_reads_untouched(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency"}], server=server)
        h.op(op="load", path="/w/1")
        assert calls[0]["fetchdef"]["headers"].get("Idempotency-Key") is None

    def test_preserves_a_caller_key_and_honours_a_custom_header(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency",
                          "options": {"header": "X-Idem"}}], server=server)
        h.op(op="create", path="/w", headers={"X-Idem": "caller-1"})
        assert calls[0]["fetchdef"]["headers"]["X-Idem"] == "caller-1"

    def test_injectable_keygen_and_stat_tracking(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency",
                          "options": {"keygen": lambda: "fixed-key"}}],
                        server=server)
        h.op(op="create", path="/w")
        assert calls[0]["fetchdef"]["headers"]["Idempotency-Key"] == "fixed-key"
        assert h.client._idempotency["issued"] == 1
        assert h.client._idempotency["last"] == "fixed-key"

    def test_default_key_generation_is_hex(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency"}], server=server)
        h.op(op="create", path="/w")
        assert re.match(r"^[0-9a-f]+$",
                        calls[0]["fetchdef"]["headers"]["Idempotency-Key"])

    def test_inactive_idempotency_is_a_no_op(self):
        server, calls = recording_server()
        h = make_client([{"name": "idempotency", "options": {"active": False}}],
                        server=server)
        h.op(op="create", path="/w")
        assert calls[0]["fetchdef"]["headers"].get("Idempotency-Key") is None


# --- rbac ---------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("rbac"), reason="rbac not in this SDK")
class TestRbacFeature:

    def test_denies_before_any_call(self):
        server, calls = recording_server()
        h = make_client([{"name": "rbac",
                          "options": {"rules": {"widget.remove": "admin"},
                                      "permissions": []}}], server=server)
        res = h.op(op="remove", path="/w/1")
        assert res["error"].code == "rbac_denied"
        assert len(calls) == 0
        assert h.client._rbac["denied"] == 1

    def test_allows_a_held_permission(self):
        h = make_client([{"name": "rbac",
                          "options": {"rules": {"widget.remove": "admin"},
                                      "permissions": ["admin"]}}])
        assert h.op(op="remove", path="/w/1")["ok"] is True
        assert h.client._rbac["allowed"] == 1

    def test_rule_by_op_name_and_wildcard_grant(self):
        h = make_client([{"name": "rbac",
                          "options": {"rules": {"load": "read"},
                                      "permissions": ["*"]}}])
        assert h.op(op="load")["ok"] is True

    def test_no_rule_allows_by_default_and_deny_true_blocks(self):
        allow = make_client([{"name": "rbac", "options": {"permissions": []}}])
        assert allow.op(op="load")["ok"] is True
        deny = make_client([{"name": "rbac",
                             "options": {"deny": True, "permissions": []}}])
        assert deny.op(op="load")["error"].code == "rbac_denied"

    def test_inactive_rbac_is_a_no_op(self):
        h = make_client([{"name": "rbac",
                          "options": {"active": False, "deny": True,
                                      "permissions": []}}])
        assert h.op(op="load")["ok"] is True


# --- metrics --------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("metrics"), reason="metrics not in this SDK")
class TestMetricsFeature:

    def test_counts_ok_and_err_per_op(self):
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1, "failStatus": 500}},
            {"name": "metrics", "options": {}},
        ])
        h.op(op="load")
        h.op(op="load")
        h.op(op="list")
        metrics = h.client._metrics
        assert metrics["total"]["count"] == 3
        assert metrics["total"]["ok"] == 2
        assert metrics["total"]["err"] == 1
        assert metrics["ops"]["widget.load"]["count"] == 2

    def test_injected_clock_records_duration(self):
        clock = make_clock()

        def server(_ctx, _url, _fetchdef):
            clock.advance(25)
            return make_response(200, {"ok": True}), None

        h = make_client([{"name": "metrics", "options": {"now": clock.now}}],
                        server=server)
        h.op(op="load")
        assert h.client._metrics["total"]["totalMs"] == 25
        assert h.client._metrics["total"]["maxMs"] == 25

    def test_inactive_metrics_records_nothing(self):
        h = make_client([{"name": "metrics", "options": {"active": False}}])
        h.op(op="load")
        assert h.client._metrics["total"]["count"] == 0


# --- telemetry --------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("telemetry"),
                    reason="telemetry not in this SDK")
class TestTelemetryFeature:

    def test_opens_spans_and_propagates_trace_headers(self):
        server, calls = recording_server()
        spans = []
        h = make_client([{"name": "telemetry",
                          "options": {"exporter": spans.append}}],
                        server=server)
        res = h.op(op="load")
        assert res["ok"] is True
        assert len(h.client._telemetry["spans"]) == 1
        assert len(spans) == 1
        sent = calls[0]["fetchdef"]["headers"]
        assert sent["X-Trace-Id"] == h.client._telemetry["spans"][0]["traceId"]
        assert re.match(r"^00-.+-.+-01$", sent["traceparent"])

    def test_records_a_failed_span_on_error(self):
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1, "failStatus": 500}},
            {"name": "telemetry", "options": {}},
        ])
        h.op(op="load")
        assert h.client._telemetry["spans"][0]["ok"] is False

    def test_closes_each_span_exactly_once(self):
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1, "failStatus": 500}},
            {"name": "telemetry", "options": {}},
        ])
        h.op(op="load")
        assert len(h.client._telemetry["spans"]) == 1
        assert h.client._telemetry["active"] == 0

    def test_injected_idgen_and_clock(self):
        h = make_client([{"name": "telemetry",
                          "options": {"idgen": lambda kind: kind + "-X",
                                      "now": lambda: 5}}])
        h.op(op="load")
        span = h.client._telemetry["spans"][0]
        assert span["traceId"] == "trace-X"
        assert span["durationMs"] == 0

    def test_default_id_generation_and_no_exporter(self):
        h = make_client([{"name": "telemetry"}])
        h.op(op="load")
        assert h.client._telemetry["spans"][0]["traceId"].startswith("t")

    def test_inactive_telemetry_records_nothing(self):
        h = make_client([{"name": "telemetry", "options": {"active": False}}])
        h.op(op="load")
        assert len(h.client._telemetry["spans"]) == 0


# --- debug ---------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("debug"), reason="debug not in this SDK")
class TestDebugFeature:

    def test_captures_a_redacted_trace_and_honours_on_entry_and_max(self):
        seen = []
        h = make_client([{"name": "debug",
                          "options": {"max": 1, "onEntry": seen.append}}])
        h.op(op="load", headers={"authorization": "Bearer secret"})
        h.op(op="list")
        entries = h.client._debug["entries"]
        assert len(entries) == 1  # ring buffer capped at max
        assert len(seen) == 2
        assert seen[0]["headers"]["authorization"] == "<redacted>"

    def test_captures_failures(self):
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1, "failStatus": 500}},
            {"name": "debug", "options": {}},
        ])
        h.op(op="load")
        assert h.client._debug["entries"][0]["ok"] is False
        assert h.client._debug["entries"][0]["status"] == 500

    def test_injected_clock_and_custom_redact(self):
        h = make_client([{"name": "debug",
                          "options": {"now": lambda: 7,
                                      "redact": ["x-secret"]}}])
        h.op(op="load", headers={"x-secret": "hide", "x-ok": "show"})
        entry = h.client._debug["entries"][0]
        assert entry["headers"]["x-secret"] == "<redacted>"
        assert entry["headers"]["x-ok"] == "show"
        assert entry["durationMs"] == 0

    def test_inactive_debug_records_nothing(self):
        h = make_client([{"name": "debug", "options": {"active": False}}])
        h.op(op="load")
        assert len(h.client._debug["entries"]) == 0


# --- audit ---------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("audit"), reason="audit not in this SDK")
class TestAuditFeature:

    def test_one_record_per_op_with_sink_and_actor(self):
        sink = []
        h = make_client([
            {"name": "netsim", "options": {"failTimes": 1, "failStatus": 500}},
            {"name": "audit", "options": {"actor": "svc",
                                          "sink": sink.append, "max": 5}},
        ])
        h.op(op="remove", path="/w/1")
        h.op(op="load", ctrl={"actor": "per-call"})
        records = h.client._audit["records"]
        assert len(records) == 2
        assert records[0]["outcome"] == "error"
        assert records[0]["actor"] == "svc"
        assert records[1]["actor"] == "per-call"
        assert records[1]["outcome"] == "ok"
        assert len(sink) == 2

    def test_default_actor_and_injected_clock(self):
        h = make_client([{"name": "audit", "options": {"now": lambda: 42}}])
        h.op(op="load")
        record = h.client._audit["records"][0]
        assert record["actor"] == "anonymous"
        assert record["ts"] == 42
        assert record["entity"] == "widget"
        assert record["op"] == "load"
        assert record["seq"] == 1
        assert record["correlationId"] is not None

    def test_max_bounds_the_record_list(self):
        h = make_client([{"name": "audit", "options": {"max": 2}}])
        h.op(op="load")
        h.op(op="load")
        h.op(op="load")
        assert len(h.client._audit["records"]) == 2

    def test_inactive_audit_records_nothing(self):
        h = make_client([{"name": "audit", "options": {"active": False}}])
        h.op(op="load")
        assert len(h.client._audit["records"]) == 0


# --- clienttrack ------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("clienttrack"),
                    reason="clienttrack not in this SDK")
class TestClienttrackFeature:

    def test_stable_client_id_unique_request_ids_and_ua(self):
        server, calls = recording_server()
        h = make_client([{"name": "clienttrack",
                          "options": {"clientName": "Acme",
                                      "clientVersion": "2.0.0"}}],
                        server=server)
        h.op(op="load")
        h.op(op="load")
        h0 = calls[0]["fetchdef"]["headers"]
        h1 = calls[1]["fetchdef"]["headers"]
        assert h0["User-Agent"] == "Acme/2.0.0"
        assert h0["X-Client-Id"] == h1["X-Client-Id"]
        assert h0["X-Request-Id"] != h1["X-Request-Id"]
        assert h.client._clienttrack["requests"] == 2

    def test_does_not_clobber_a_caller_user_agent(self):
        server, calls = recording_server()
        h = make_client([{"name": "clienttrack"}], server=server)
        h.op(op="load", headers={"User-Agent": "mine"})
        assert calls[0]["fetchdef"]["headers"]["User-Agent"] == "mine"

    def test_injected_idgen_and_fixed_session(self):
        server, calls = recording_server()
        h = make_client([{"name": "clienttrack",
                          "options": {"sessionId": "S1",
                                      "idgen": lambda kind: kind + "-1"}}],
                        server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"]["headers"]["X-Client-Id"] == "S1"
        assert calls[0]["fetchdef"]["headers"]["X-Request-Id"] == "request-1"

    def test_inactive_clienttrack_stamps_nothing(self):
        server, calls = recording_server()
        h = make_client([{"name": "clienttrack", "options": {"active": False}}],
                        server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"]["headers"].get("X-Client-Id") is None


# --- paging ---------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("paging"), reason="paging not in this SDK")
class TestPagingFeature:

    def test_stamps_page_limit_and_reads_header_signals(self):
        server, calls = recording_server(lambda _n, _fd: make_response(
            200, {"items": [1, 2]},
            {"x-next-page": "2", "x-total-count": "5",
             "link": '</w?page=2>; rel="next"'}))
        h = make_client([{"name": "paging", "options": {"limit": 2}}],
                        server=server)
        res = h.op(op="list", path="/w")
        assert re.search(r"[?&]page=1(&|$)", calls[0]["url"])
        assert re.search(r"[?&]limit=2(&|$)", calls[0]["url"])
        assert res["result"].paging["nextPage"] == 2
        assert res["result"].paging["totalCount"] == 5
        assert res["result"].paging["next"] == "/w?page=2"
        assert res["result"].paging["hasMore"] is True

    def test_body_cursor_and_explicit_cursor_request(self):
        server, calls = recording_server(lambda _n, _fd: make_response(
            200, {"nextCursor": "abc", "hasMore": True}))
        h = make_client([{"name": "paging"}], server=server)
        res = h.op(op="list", path="/w", ctrl={"paging": {"cursor": "xyz"}})
        assert re.search(r"[?&]cursor=xyz(&|$)", calls[0]["url"])
        assert res["result"].paging["cursor"] == "abc"
        assert res["result"].paging["hasMore"] is True

    def test_non_list_op_is_not_paged(self):
        server, calls = recording_server()
        h = make_client([{"name": "paging"}], server=server)
        h.op(op="load", path="/w/1")
        assert not re.search(r"[?&]page=", calls[0]["url"])

    def test_inactive_paging_stamps_nothing(self):
        server, calls = recording_server()
        h = make_client([{"name": "paging", "options": {"active": False}}],
                        server=server)
        h.op(op="list", path="/w")
        assert not re.search(r"[?&]page=", calls[0]["url"])


# --- streaming --------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("streaming"),
                    reason="streaming not in this SDK")
class TestStreamingFeature:

    def test_streams_list_items(self):
        clock = make_clock()
        server, _calls = recording_server(
            lambda _n, _fd: make_response(200, ["a", "b", "c"]))
        h = make_client([{"name": "streaming",
                          "options": {"chunkDelay": 5, "sleep": clock.sleep}}],
                        server=server)
        res = h.op(op="list", path="/w")
        assert res["result"].streaming is True
        seen = list(res["result"].stream())
        assert seen == ["a", "b", "c"]
        assert clock.time == 15

    def test_batches_with_chunk_size(self):
        server, _calls = recording_server(
            lambda _n, _fd: make_response(200, [1, 2, 3, 4, 5]))
        h = make_client([{"name": "streaming", "options": {"chunkSize": 2}}],
                        server=server)
        res = h.op(op="list", path="/w")
        batches = list(res["result"].stream())
        assert batches == [[1, 2], [3, 4], [5]]

    def test_non_list_op_is_not_streamed(self):
        h = make_client([{"name": "streaming"}])
        res = h.op(op="load")
        assert getattr(res["result"], "streaming", None) is None

    def test_inactive_streaming_attaches_nothing(self):
        server, _calls = recording_server(
            lambda _n, _fd: make_response(200, ["a"]))
        h = make_client([{"name": "streaming", "options": {"active": False}}],
                        server=server)
        res = h.op(op="list", path="/w")
        assert getattr(res["result"], "streaming", None) is None


# --- proxy ---------------------------------------------------------------------
@pytest.mark.skipif(not has_feature("proxy"), reason="proxy not in this SDK")
class TestProxyFeature:

    def test_routes_through_the_proxy_and_invokes_an_agent_factory(self):
        server, calls = recording_server()
        state = {"agent_url": ""}

        def agent(proxy_url, _url):
            state["agent_url"] = proxy_url
            return {"a": 1}

        h = make_client([{"name": "proxy",
                          "options": {"url": "http://proxy:8080",
                                      "agent": agent}}], server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"]["proxy"] == "http://proxy:8080"
        assert calls[0]["fetchdef"]["proxies"]["https"] == "http://proxy:8080"
        assert calls[0]["fetchdef"]["dispatcher"]["a"] == 1
        assert state["agent_url"] == "http://proxy:8080"
        assert h.client._proxy["routed"] == 1

    def test_bypasses_no_proxy_hosts(self):
        server, calls = recording_server()
        h = make_client([{"name": "proxy",
                          "options": {"url": "http://proxy:8080",
                                      "noProxy": ["api.test"]}}],
                        server=server, base="http://api.test")
        h.op(op="load")
        assert calls[0]["fetchdef"].get("proxy") is None

    def test_no_url_set_is_a_no_op(self):
        server, calls = recording_server()
        h = make_client([{"name": "proxy", "options": {}}], server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"].get("proxy") is None

    def test_from_env_reads_https_proxy(self, monkeypatch):
        monkeypatch.setenv("HTTPS_PROXY", "http://env-proxy:8080")
        server, calls = recording_server()
        h = make_client([{"name": "proxy", "options": {"fromEnv": True}}],
                        server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"]["proxy"] == "http://env-proxy:8080"

    def test_inactive_proxy_does_not_wrap(self):
        server, calls = recording_server()
        h = make_client([{"name": "proxy",
                          "options": {"active": False,
                                      "url": "http://proxy:8080"}}],
                        server=server)
        h.op(op="load")
        assert calls[0]["fetchdef"].get("proxy") is None


# --- composition ------------------------------------------------------------------
@pytest.mark.skipif(not (has_feature("cache") and has_feature("netsim")),
                    reason="cache+netsim not in this SDK")
def test_cache_plus_netsim_a_hit_skips_the_simulated_failure():
    h = make_client([
        {"name": "netsim", "options": {"failEvery": 2}},
        {"name": "cache", "options": {"ttl": 10000}},
    ])
    assert h.op(op="load", path="/w")["ok"] is True
    assert h.op(op="load", path="/w")["ok"] is True
    assert h.client._netsim["calls"] == 1
