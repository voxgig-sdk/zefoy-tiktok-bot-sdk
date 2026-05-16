# ZefoyTiktokBot SDK exists test

require "minitest/autorun"
require_relative "../ZefoyTiktokBot_sdk"

class ExistsTest < Minitest::Test
  def test_create_test_sdk
    testsdk = ZefoyTiktokBotSDK.test(nil, nil)
    assert !testsdk.nil?
  end
end
