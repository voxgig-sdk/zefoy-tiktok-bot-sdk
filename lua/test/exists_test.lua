-- ProjectName SDK exists test

local sdk = require("zefoy-tiktok-bot_sdk")

describe("ZefoyTiktokBotSDK", function()
  it("should create test SDK", function()
    local testsdk = sdk.test(nil, nil)
    assert.is_not_nil(testsdk)
  end)
end)
