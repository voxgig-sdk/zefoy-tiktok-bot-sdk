# ZefoyTiktokBot SDK netsim test

import time

from projectname_sdk import ZefoyTiktokBotSDK


# Network-behaviour simulation over the offline mock transport. The `test`
# feature accepts an optional `net` config so unit tests can exercise slow,
# failing and offline conditions without a live server. These checks drive
# the transport through `direct()`, which needs no entity, so they run for
# every generated SDK regardless of its API shape.
class TestNetsim:

    def test_offline_simulation_fails_the_request(self):
        sdk = ZefoyTiktokBotSDK.test({"net": {"offline": True}})
        res = sdk.direct({"path": "/ping"})
        assert res["ok"] is False, "offline network must fail the call"

    def test_fail_status_simulation_surfaces_the_error_status(self):
        sdk = ZefoyTiktokBotSDK.test({"net": {"failTimes": 1, "failStatus": 503}})
        res = sdk.direct({"path": "/ping"})
        assert res["ok"] is False
        assert res["status"] == 503, "simulated failure status is surfaced"

    def test_error_times_simulation_yields_a_connection_error(self):
        sdk = ZefoyTiktokBotSDK.test({"net": {"errorTimes": 1}})
        res = sdk.direct({"path": "/ping"})
        assert res["ok"] is False
        assert res.get("err") is not None
        assert getattr(res["err"], "code", None) == "netsim_conn"

    def test_latency_simulation_delays_the_request(self):
        delay = 60
        sdk = ZefoyTiktokBotSDK.test({"net": {"latency": delay}})
        start = time.time()
        sdk.direct({"path": "/ping"})
        elapsed = (time.time() - start) * 1000
        # Generous lower bound to stay robust on slow CI.
        assert elapsed >= delay - 25, \
            "expected >= {}ms latency, got {}ms".format(delay - 25, elapsed)

    def test_injectable_sleep_keeps_latency_deterministic(self):
        slept = []
        sdk = ZefoyTiktokBotSDK.test({"net": {"latency": 250,
                                           "sleep": slept.append}})
        sdk.direct({"path": "/ping"})
        assert slept == [250]

    def test_a_plain_test_sdk_still_works_with_no_net_simulation(self):
        sdk = ZefoyTiktokBotSDK.test()
        assert sdk is not None
