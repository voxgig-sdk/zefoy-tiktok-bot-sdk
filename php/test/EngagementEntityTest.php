<?php
declare(strict_types=1);

// Engagement entity test

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;
use Voxgig\Struct\Struct as Vs;

class EngagementEntityTest extends TestCase
{
    public function test_create_instance(): void
    {
        $testsdk = ZefoyTiktokBotSDK::test(null, null);
        $ent = $testsdk->Engagement(null);
        $this->assertNotNull($ent);
    }

    public function test_basic_flow(): void
    {
        $setup = engagement_basic_setup(null);
        // Per-op sdk-test-control.json skip.
        $_live = !empty($setup["live"]);
        foreach (["create"] as $_op) {
            [$_shouldSkip, $_reason] = Runner::is_control_skipped("entityOp", "engagement." . $_op, $_live ? "live" : "unit");
            if ($_shouldSkip) {
                $this->markTestSkipped($_reason ?? "skipped via sdk-test-control.json");
                return;
            }
        }
        // The basic flow consumes synthetic IDs from the fixture. In live mode
        // without an *_ENTID env override, those IDs hit the live API and 4xx.
        if (!empty($setup["synthetic_only"])) {
            $this->markTestSkipped("live entity test uses synthetic IDs from fixture — set ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID JSON to run live");
            return;
        }
        $client = $setup["client"];

        // CREATE
        $engagement_ref01_ent = $client->Engagement(null);
        $engagement_ref01_data = Helpers::to_map(Vs::getprop(
            Vs::getpath($setup["data"], "new.engagement"), "engagement_ref01"));

        $engagement_ref01_data_result = $engagement_ref01_ent->create($engagement_ref01_data, null);
        $engagement_ref01_data = Helpers::to_map($engagement_ref01_data_result);
        $this->assertNotNull($engagement_ref01_data);

    }
}

function engagement_basic_setup($extra)
{
    Runner::load_env_local();

    $entity_data_file = __DIR__ . '/../../.sdk/test/entity/engagement/EngagementTestData.json';
    $entity_data_source = file_get_contents($entity_data_file);
    $entity_data = json_decode($entity_data_source, true);

    $options = [];
    $options["entity"] = $entity_data["existing"];

    $client = ZefoyTiktokBotSDK::test($options, $extra);

    // Generate idmap.
    $idmap = [];
    foreach (["engagement01", "engagement02", "engagement03"] as $k) {
        $idmap[$k] = strtoupper($k);
    }

    // Detect ENTID env override before envOverride consumes it. When live
    // mode is on without a real override, the basic test runs against synthetic
    // IDs from the fixture and 4xx's. Surface this so the test can skip.
    $entid_env_raw = getenv("ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID");
    $idmap_overridden = $entid_env_raw !== false && str_starts_with(trim($entid_env_raw), "{");

    $env = Runner::env_override([
        "ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID" => $idmap,
        "ZEFOYTIKTOKBOT_TEST_LIVE" => "FALSE",
        "ZEFOYTIKTOKBOT_TEST_EXPLAIN" => "FALSE",
        "ZEFOYTIKTOKBOT_APIKEY" => "NONE",
    ]);

    $idmap_resolved = Helpers::to_map(
        $env["ZEFOYTIKTOKBOT_TEST_ENGAGEMENT_ENTID"]);
    if ($idmap_resolved === null) {
        $idmap_resolved = Helpers::to_map($idmap);
    }

    if ($env["ZEFOYTIKTOKBOT_TEST_LIVE"] === "TRUE") {
        $merged_opts = Vs::merge([
            [
                "apikey" => $env["ZEFOYTIKTOKBOT_APIKEY"],
            ],
            $extra ?? [],
        ]);
        $client = new ZefoyTiktokBotSDK(Helpers::to_map($merged_opts));
    }

    $live = $env["ZEFOYTIKTOKBOT_TEST_LIVE"] === "TRUE";
    return [
        "client" => $client,
        "data" => $entity_data,
        "idmap" => $idmap_resolved,
        "env" => $env,
        "explain" => $env["ZEFOYTIKTOKBOT_TEST_EXPLAIN"] === "TRUE",
        "live" => $live,
        "synthetic_only" => $live && !$idmap_overridden,
        "now" => (int)(microtime(true) * 1000),
    ];
}
