<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK netsim test
//
// Network-behaviour simulation over the offline mock transport. The `test`
// feature accepts an optional `net` config so unit tests can exercise slow,
// failing and offline conditions without a live server. These checks drive
// the transport through `direct()`, which needs no entity, so they run for
// every generated SDK regardless of its API shape. Mirrors
// tm/ts/test/netsim.test.ts.

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;

class NetsimTest extends TestCase
{
    public function test_offline_simulation_fails_the_request(): void
    {
        $sdk = ZefoyTiktokBotSDK::test(['net' => ['offline' => true]]);
        $res = $sdk->direct(['path' => '/ping']);
        $this->assertFalse($res['ok'], 'offline network must fail the call');
        $this->assertNotNull($res['err'] ?? null);
    }

    public function test_fail_status_simulation_surfaces_the_error_status(): void
    {
        $sdk = ZefoyTiktokBotSDK::test(['net' => ['failTimes' => 1, 'failStatus' => 503]]);
        $res = $sdk->direct(['path' => '/ping']);
        $this->assertFalse($res['ok']);
        $this->assertSame(503, $res['status'], 'simulated failure status is surfaced');
    }

    public function test_latency_simulation_delays_the_request(): void
    {
        $delay = 60;
        $sdk = ZefoyTiktokBotSDK::test(['net' => ['latency' => $delay]]);
        $start = microtime(true);
        $sdk->direct(['path' => '/ping']);
        $elapsed_ms = (microtime(true) - $start) * 1000.0;
        // Generous lower bound to stay robust on slow CI.
        $this->assertGreaterThanOrEqual($delay - 25, $elapsed_ms,
            "expected >= " . ($delay - 25) . "ms latency, got {$elapsed_ms}ms");
    }

    public function test_a_plain_test_sdk_still_works_with_no_net_simulation(): void
    {
        $sdk = ZefoyTiktokBotSDK::test();
        $this->assertNotNull($sdk);
    }
}
