# Engagement entity test

require "minitest/autorun"
require "json"
require_relative "../ZefoyTiktokBot_sdk"
require_relative "runner"

class EngagementEntityTest < Minitest::Test
  def test_create_instance
    testsdk = ZefoyTiktokBotSDK.test(nil, nil)
    ent = testsdk.Engagement(nil)
    assert !ent.nil?
  end

  def test_basic_flow
    setup = engagement_basic_setup(nil)
    # Per-op sdk-test-control.json skip.
    _live = setup[:live] || false
    ["create"].each do |_op|
      _should_skip, _reason = Runner.is_control_skipped("entityOp", "engagement." + _op, _live ? "live" : "unit")
      if _should_skip
        skip(_reason || "skipped via sdk-test-control.json")
        return
      end
    end
    # The basic flow consumes synthetic IDs from the fixture. In live mode
    # without an *_ENTID env override, those IDs hit the live API and 4xx.
    if setup[:synthetic_only]
      skip "live entity test uses synthetic IDs from fixture — set ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID JSON to run live"
      return
    end
    client = setup[:client]

    # CREATE
    engagement_ref01_ent = client.Engagement(nil)
    engagement_ref01_data = Helpers.to_map(Vs.getprop(
      Vs.getpath(setup[:data], "new.engagement"), "engagement_ref01"))

    engagement_ref01_data_result, err = engagement_ref01_ent.create(engagement_ref01_data, nil)
    assert_nil err
    engagement_ref01_data = Helpers.to_map(engagement_ref01_data_result)
    assert !engagement_ref01_data.nil?

  end
end

def engagement_basic_setup(extra)
  Runner.load_env_local

  entity_data_file = File.join(__dir__, "..", "..", ".sdk", "test", "entity", "engagement", "EngagementTestData.json")
  entity_data_source = File.read(entity_data_file)
  entity_data = JSON.parse(entity_data_source)

  options = {}
  options["entity"] = entity_data["existing"]

  client = ZefoyTiktokBotSDK.test(options, extra)

  # Generate idmap via transform.
  idmap = Vs.transform(
    ["engagement01", "engagement02", "engagement03"],
    {
      "`$PACK`" => ["", {
        "`$KEY`" => "`$COPY`",
        "`$VAL`" => ["`$FORMAT`", "upper", "`$COPY`"],
      }],
    }
  )

  # Detect ENTID env override before envOverride consumes it. When live
  # mode is on without a real override, the basic test runs against synthetic
  # IDs from the fixture and 4xx's. Surface this so the test can skip.
  entid_env_raw = ENV["ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID"]
  idmap_overridden = !entid_env_raw.nil? && entid_env_raw.strip.start_with?("{")

  env = Runner.env_override({
    "ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID" => idmap,
    "ZEFOYTIKTOKBOT_TEST_LIVE" => "FALSE",
    "ZEFOYTIKTOKBOT_TEST_EXPLAIN" => "FALSE",
    "ZEFOYTIKTOKBOT_APIKEY" => "NONE",
  })

  idmap_resolved = Helpers.to_map(
    env["ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID"])
  if idmap_resolved.nil?
    idmap_resolved = Helpers.to_map(idmap)
  end

  if env["ZEFOYTIKTOKBOT_TEST_LIVE"] == "TRUE"
    merged_opts = Vs.merge([
      {
        "apikey" => env["ZEFOYTIKTOKBOT_APIKEY"],
      },
      extra || {},
    ])
    client = ZefoyTiktokBotSDK.new(Helpers.to_map(merged_opts))
  end

  live = env["ZEFOYTIKTOKBOT_TEST_LIVE"] == "TRUE"
  {
    client: client,
    data: entity_data,
    idmap: idmap_resolved,
    env: env,
    explain: env["ZEFOYTIKTOKBOT_TEST_EXPLAIN"] == "TRUE",
    live: live,
    synthetic_only: live && !idmap_overridden,
    now: (Time.now.to_f * 1000).to_i,
  }
end
