# ZefoyTiktokBot SDK netsim test
#
# Network-behaviour simulation over the offline mock transport. The test
# feature accepts an optional "net" config so unit tests can exercise slow,
# failing and offline conditions without a live server. These checks drive
# the transport through direct(), which needs no entity, so they run for
# every generated SDK regardless of its API shape.

require "minitest/autorun"
require_relative "../ZefoyTiktokBot_sdk"

class NetsimTest < Minitest::Test
  def test_offline_simulation_fails_the_request
    sdk = ZefoyTiktokBotSDK.test({ "net" => { "offline" => true } }, nil)
    res = sdk.direct({ "path" => "/ping" })
    assert_equal false, res["ok"], "offline network must fail the call"
    refute_nil res["err"]
  end

  def test_fail_status_simulation_surfaces_the_error_status
    sdk = ZefoyTiktokBotSDK.test({ "net" => { "failTimes" => 1, "failStatus" => 503 } }, nil)
    res = sdk.direct({ "path" => "/ping" })
    assert_equal false, res["ok"]
    assert_equal 503, res["status"], "simulated failure status is surfaced"
  end

  def test_error_times_simulation_yields_a_connection_error
    sdk = ZefoyTiktokBotSDK.test({ "net" => { "errorTimes" => 1 } }, nil)
    res = sdk.direct({ "path" => "/ping" })
    assert_equal false, res["ok"]
    assert_match(/connection error/i, res["err"].to_s)
  end

  def test_latency_simulation_delays_the_request
    delay = 60
    sdk = ZefoyTiktokBotSDK.test({ "net" => { "latency" => delay } }, nil)
    start = Time.now.to_f
    sdk.direct({ "path" => "/ping" })
    elapsed = ((Time.now.to_f - start) * 1000).to_i
    # Generous lower bound to stay robust on slow CI.
    assert elapsed >= delay - 25, "expected >= #{delay - 25}ms latency, got #{elapsed}ms"
  end

  def test_plain_test_sdk_still_works_with_no_net_simulation
    sdk = ZefoyTiktokBotSDK.test(nil, nil)
    refute_nil sdk
  end
end
