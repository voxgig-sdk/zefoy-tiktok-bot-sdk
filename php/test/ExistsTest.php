<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK exists test

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';

use PHPUnit\Framework\TestCase;

class ExistsTest extends TestCase
{
    public function test_create_test_sdk(): void
    {
        $testsdk = ZefoyTiktokBotSDK::test(null, null);
        $this->assertNotNull($testsdk);
    }
}
