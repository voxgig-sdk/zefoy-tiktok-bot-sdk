-- ZefoyTiktokBot SDK netsim test
--
-- Network-behaviour simulation over the offline mock transport. The
-- `test` feature accepts an optional `net` config so unit tests can
-- exercise slow, failing and offline conditions without a live server.
-- These checks drive the transport through `direct()`, which needs no
-- entity, so they run for every generated SDK regardless of its API
-- shape.

local sdk = require("zefoy-tiktok-bot_sdk")


describe("netsim", function()

  it("offline simulation fails the request", function()
    local client = sdk.test({ net = { offline = true } }, nil)
    local res = client:direct({ path = "/ping" })
    assert.are.equal(false, res.ok, "offline network must fail the call")
  end)

  it("failStatus simulation surfaces the error status", function()
    local client = sdk.test({ net = { failTimes = 1, failStatus = 503 } }, nil)
    local res = client:direct({ path = "/ping" })
    assert.are.equal(false, res.ok)
    assert.are.equal(503, res.status, "simulated failure status is surfaced")
  end)

  it("latency simulation delays the request", function()
    local delay = 60
    local client = sdk.test({ net = { latency = delay } }, nil)
    -- The default netsim sleep is a CPU spin, so os.clock() measures it.
    local start = os.clock()
    client:direct({ path = "/ping" })
    local elapsed = (os.clock() - start) * 1000
    -- Generous lower bound to stay robust on slow CI.
    assert.is_true(elapsed >= delay - 25,
      "expected >= " .. (delay - 25) .. "ms latency, got " .. elapsed .. "ms")
  end)

  it("injected sleep makes latency deterministic", function()
    local slept = 0
    local client = sdk.test({ net = {
      latency = 250,
      sleep = function(ms) slept = slept + ms end,
    } }, nil)
    client:direct({ path = "/ping" })
    assert.are.equal(250, slept)
  end)

  it("connection errors are simulated first-N", function()
    local client = sdk.test({ net = { errorTimes = 1 } }, nil)
    local res = client:direct({ path = "/ping" })
    assert.are.equal(false, res.ok)
    assert.are.equal("netsim_conn", res.err.code)
  end)

  it("a plain test SDK still works with no net simulation", function()
    local client = sdk.test(nil, nil)
    assert.is_not_nil(client)
  end)
end)
