<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK feature test
//
// Behavioural + coverage tests for the enterprise features shipped with
// this SDK. Each block runs only when its feature is present (see
// FtHarness::hasFeature), driving the real generated feature class through
// an offline harness pipeline against a simulated network. The harness is a
// faithful miniature of the real operation pipeline — the same hook order
// and short-circuit rules as the generated entity op code (PrePoint,
// PreSpec, PreRequest, PreResponse, PreResult, PreDone, PreUnexpected) —
// with no live server and no API-specific fixtures. Mirrors
// tm/ts/test/feature.test.ts + tm/ts/test/feature/harness.ts.
//
// Note: the generated PHP pipeline dispatches PrePoint..PreDone; the
// PreUnexpected hook is dispatched here by the harness failure path (the
// real pipeline raises via make_error before a PreUnexpected dispatch
// point), which keeps the features' emit-once semantics covered.

require_once __DIR__ . '/../projectname_sdk.php';

use PHPUnit\Framework\TestCase;

// A deterministic virtual clock: `now()` reads a counter that advances only
// when `sleep(ms)` is called, so timing-based features can be asserted
// without real delays.
class FtClock
{
    public float $t;

    public function __construct(float $start = 0.0)
    {
        $this->t = $start;
    }

    public function now(): callable
    {
        return function (): float {
            return $this->t;
        };
    }

    public function sleep(): callable
    {
        return function (mixed $ms): void {
            $this->t += is_numeric($ms) ? (float)$ms : 0.0;
        };
    }

    public function advance(float $ms): void
    {
        $this->t += $ms;
    }
}

// Control extension carrying the optional per-call fields some features
// read (audit: actor; paging: paging).
class FtCtrl extends ZefoyTiktokBotControl
{
    public mixed $actor = null;
    public mixed $paging = null;
}

// Fake entity: just enough for Context::resolve_op and rbac's entity name.
class FtEntity
{
    private string $name;

    public function __construct(string $name)
    {
        $this->name = $name;
    }

    public function get_name(): string
    {
        return $this->name;
    }
}

// Fake client: the surface features touch — mode, features list, options
// map — plus dynamic diagnostic properties (_retry, _cache, ...).
#[\AllowDynamicProperties]
class FtClient
{
    public string $mode = 'test';
    public array $features = [];
    public array $options;
    private ZefoyTiktokBotUtility $utility;

    public function __construct(ZefoyTiktokBotUtility $utility, array $options)
    {
        $this->utility = $utility;
        $this->options = $options;
    }

    public function options_map(): array
    {
        return $this->options;
    }

    public function get_utility(): ZefoyTiktokBotUtility
    {
        return $this->utility;
    }
}

// Records every transport call; an optional reply callback shapes the
// response (either a response array, or a full [response, err] tuple).
class FtRecorder
{
    public array $calls = [];
    public mixed $reply;

    public function __construct(?callable $reply = null)
    {
        $this->reply = $reply;
    }

    public function server(): callable
    {
        return function (ZefoyTiktokBotContext $_ctx, string $url, array $fetchdef): array {
            $this->calls[] = ['url' => $url, 'fetchdef' => $fetchdef];
            $n = count($this->calls);
            if ($this->reply !== null) {
                $r = ($this->reply)($n, $fetchdef);
                if (is_array($r) && array_is_list($r) && count($r) === 2) {
                    return $r;
                }
                return [$r, null];
            }
            return [FtHarness::response(200, ['ok' => true, 'n' => $n]), null];
        };
    }
}

// Constructs a fake client wired with the given features (in init order —
// each transport-wrapping feature wraps the previous fetcher) and a mini
// operation pipeline.
class FtHarness
{
    private static ?array $feature_config = null;

    public FtClient $client;
    public ZefoyTiktokBotUtility $utility;
    public ZefoyTiktokBotContext $rootctx;

    // True when this SDK was generated with the named feature.
    public static function hasFeature(string $name): bool
    {
        if (self::$feature_config === null) {
            $config = ZefoyTiktokBotConfig::make_config();
            $f = $config['feature'] ?? [];
            self::$feature_config = is_array($f) ? $f : [];
        }
        return isset(self::$feature_config[$name]);
    }

    // Build a transport-shaped response the pipeline understands.
    public static function response(int $status, mixed $data = null, array $headers = []): array
    {
        $h = [];
        foreach ($headers as $k => $v) {
            $h[strtolower((string)$k)] = $v;
        }
        return [
            'status' => $status,
            'statusText' => $status < 400 ? 'OK' : 'ERR',
            'body' => 'not-used',
            'json' => function () use ($data) { return $data; },
            'headers' => $h,
        ];
    }

    /**
     * @param array $features list of ['name' => ..., 'options' => [...]]
     */
    public function __construct(
        array $features,
        ?callable $server = null,
        string $base = 'http://api.test',
        array $headers = []
    ) {
        $utility = new ZefoyTiktokBotUtility();
        $this->utility = $utility;

        $utility->fetcher = $server ?? function (ZefoyTiktokBotContext $_ctx, string $_url, array $fetchdef): array {
            $method = strtoupper((string)($fetchdef['method'] ?? 'GET'));
            return [self::response(200, ['ok' => true, 'method' => $method]), null];
        };

        $this->client = new FtClient($utility, [
            'base' => $base,
            'headers' => $headers,
            'feature' => [],
        ]);

        $this->rootctx = ($utility->make_context)([
            'client' => $this->client,
            'utility' => $utility,
        ], null);

        // Instantiate + init the requested features (skipping any not present
        // in this SDK), then fire PostConstruct.
        foreach ($features as $fspec) {
            $name = $fspec['name'];
            if (!self::hasFeature($name)) {
                continue;
            }
            $f = ZefoyTiktokBotConfig::make_feature($name);
            $fopts = array_merge(['active' => true], $fspec['options'] ?? []);
            $this->client->options['feature'][$f->get_name()] = $fopts;
            $f->init($this->rootctx, $fopts);
            $this->client->features[] = $f;
        }

        ($utility->feature_hook)($this->rootctx, 'PostConstruct');
    }

    public function feature(string $name): mixed
    {
        foreach ($this->client->features as $f) {
            if ($f->get_name() === $name) {
                return $f;
            }
        }
        return null;
    }

    private static function defaultMethod(string $op): string
    {
        if ($op === 'create') {
            return 'POST';
        }
        if ($op === 'update') {
            return 'PATCH';
        }
        if ($op === 'remove') {
            return 'DELETE';
        }
        return 'GET';
    }

    private static function buildUrl(ZefoyTiktokBotSpec $spec): string
    {
        $keys = [];
        foreach ($spec->query as $k => $v) {
            if ($v !== null) {
                $keys[] = $k;
            }
        }
        sort($keys);
        $parts = [];
        foreach ($keys as $k) {
            $parts[] = rawurlencode((string)$k) . '=' . rawurlencode((string)$spec->query[$k]);
        }
        $qs = implode('&', $parts);
        return $spec->base . $spec->path . ($qs !== '' ? '?' . $qs : '');
    }

    // Run one operation through the mini pipeline (mirrors the generated
    // entity op fragment: hook, short-circuit, transport, hook, ...).
    public function op(array $o = []): array
    {
        $entity = $o['entity'] ?? 'widget';
        $opname = $o['op'] ?? 'load';
        $method = $o['method'] ?? self::defaultMethod($opname);
        $utility = $this->utility;

        $ctx = ($utility->make_context)([
            'opname' => $opname,
            'client' => $this->client,
            'utility' => $utility,
            'entity' => new FtEntity($entity),
        ], $this->rootctx);

        $ctrl = new FtCtrl();
        $co = $o['ctrl'] ?? [];
        $ctrl->actor = $co['actor'] ?? null;
        $ctrl->paging = $co['paging'] ?? null;
        if (isset($co['explain']) && is_array($co['explain'])) {
            $ctrl->explain = $co['explain'];
        }
        $ctx->ctrl = $ctrl;

        ($utility->feature_hook)($ctx, 'PostConstructEntity');

        ($utility->feature_hook)($ctx, 'PrePoint');
        if (($ctx->out['point'] ?? null) instanceof ZefoyTiktokBotError) {
            return $this->fail($ctx, $ctx->out['point']);
        }

        ($utility->feature_hook)($ctx, 'PreSpec');
        $ctx->spec = new ZefoyTiktokBotSpec([
            'method' => $method,
            'base' => $this->client->options['base'],
            'path' => $o['path'] ?? ('/' . $entity),
            'headers' => array_merge($this->client->options['headers'], $o['headers'] ?? []),
            'query' => $o['query'] ?? [],
            'body' => $o['body'] ?? null,
            'step' => 'start',
        ]);

        ($utility->feature_hook)($ctx, 'PreRequest');
        $ctx->spec->url = self::buildUrl($ctx->spec);

        $fetchdef = [
            'url' => $ctx->spec->url,
            'method' => $ctx->spec->method,
            'headers' => $ctx->spec->headers,
        ];
        if ($ctx->spec->body !== null) {
            $fetchdef['body'] = is_string($ctx->spec->body)
                ? $ctx->spec->body : json_encode($ctx->spec->body);
        }

        [$fetched, $fetch_err] = ($utility->fetcher)($ctx, $fetchdef['url'], $fetchdef);

        if (is_array($fetched)) {
            $ctx->response = new ZefoyTiktokBotResponse($fetched);
        }

        ($utility->feature_hook)($ctx, 'PreResponse');

        $result = new ZefoyTiktokBotResult([]);
        $ctx->result = $result;

        if ($fetch_err !== null) {
            $result->err = $fetch_err;
        } elseif (is_array($fetched)) {
            $result->status = is_numeric($fetched['status'] ?? null) ? (int)$fetched['status'] : -1;
            $result->status_text = (string)($fetched['statusText'] ?? '');
            $h = $fetched['headers'] ?? [];
            $result->headers = is_array($h) ? $h : [];
            $jf = $fetched['json'] ?? null;
            $result->body = is_callable($jf) ? $jf() : null;
            $result->resdata = $result->body;
            if ($result->status >= 400) {
                $result->err = $ctx->make_error('request_status',
                    "request: {$result->status}: {$result->status_text}");
            }
            if ($result->err === null) {
                $result->ok = true;
            }
        } else {
            $result->err = $ctx->make_error('op_failed', 'no response');
        }

        ($utility->feature_hook)($ctx, 'PreResult');
        ($utility->feature_hook)($ctx, 'PreDone');

        if ($result->ok) {
            return [
                'ok' => true, 'data' => $result->resdata, 'err' => null,
                'result' => $result, 'ctx' => $ctx,
            ];
        }
        return $this->fail($ctx, $result->err);
    }

    private function fail(ZefoyTiktokBotContext $ctx, mixed $err): array
    {
        ($this->utility->feature_hook)($ctx, 'PreUnexpected');
        return [
            'ok' => false, 'data' => null, 'err' => $err,
            'result' => $ctx->result, 'ctx' => $ctx,
        ];
    }
}

class FeatureTest extends TestCase
{
    private function needs(string ...$names): void
    {
        foreach ($names as $n) {
            if (!FtHarness::hasFeature($n)) {
                $this->markTestSkipped("feature '{$n}' not generated in this SDK");
            }
        }
    }

    private static function code(mixed $err): string
    {
        return ($err instanceof ZefoyTiktokBotError) ? $err->sdk_code : '';
    }

    public function test_at_least_the_test_feature_is_present(): void
    {
        $this->assertTrue(FtHarness::hasFeature('test'));
    }


    // --- netsim -----------------------------------------------------------

    public function test_netsim_fixed_latency_then_delegate(): void
    {
        $this->needs('netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['latency' => 250, 'sleep' => $clock->sleep()]],
        ]);
        $res = $h->op(['op' => 'load', 'ctrl' => ['explain' => ['on' => true]]]);
        $this->assertTrue($res['ok']);
        $this->assertEquals(250, $clock->t);
        $this->assertSame(1, $h->client->_netsim['calls']);
        $this->assertSame(1, $res['ctx']->ctrl->explain['netsim']['calls']);
    }

    public function test_netsim_ranged_latency_samples_within_range(): void
    {
        $this->needs('netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => [
                'latency' => ['min' => 100, 'max' => 300], 'seed' => 7, 'sleep' => $clock->sleep(),
            ]],
        ]);
        $h->op(['op' => 'load']);
        $this->assertTrue($clock->t >= 100 && $clock->t < 300, 'latency in range, got ' . $clock->t);
    }

    public function test_netsim_equal_min_max_latency_is_exact(): void
    {
        $this->needs('netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => [
                'latency' => ['min' => 50, 'max' => 50], 'sleep' => $clock->sleep(),
            ]],
        ]);
        $h->op(['op' => 'load']);
        $this->assertEquals(50, $clock->t);
    }

    public function test_netsim_fail_times_returns_retryable_status(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 2, 'failStatus' => 503]],
        ]);
        $this->assertSame(503, $h->op(['op' => 'load'])['result']->status);
        $this->assertSame(503, $h->op(['op' => 'load'])['result']->status);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
    }

    public function test_netsim_fail_every_fails_every_nth_call(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failEvery' => 2]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        $this->assertFalse($h->op(['op' => 'load'])['ok']);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
    }

    public function test_netsim_fail_rate_with_seed_is_deterministic(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failRate' => 1, 'seed' => 5]],
        ]);
        $this->assertFalse($h->op(['op' => 'load'])['ok']);
    }

    public function test_netsim_error_times_yields_connection_error(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['errorTimes' => 1]],
        ]);
        $this->assertSame('netsim_conn', self::code($h->op(['op' => 'load'])['err']));
    }

    public function test_netsim_offline_fails_every_call(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['offline' => true]],
        ]);
        $this->assertSame('netsim_offline', self::code($h->op(['op' => 'load'])['err']));
    }

    public function test_netsim_rate_limit_times_returns_429_and_retry_after(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['rateLimitTimes' => 1, 'retryAfter' => 3]],
        ]);
        $res = $h->op(['op' => 'load']);
        $this->assertSame(429, $res['result']->status);
        $this->assertSame('3', $res['result']->headers['retry-after']);
    }

    public function test_netsim_inactive_does_not_wrap(): void
    {
        $this->needs('netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['active' => false]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        $this->assertFalse(isset($h->client->_netsim));
    }


    // --- retry ------------------------------------------------------------

    public function test_retry_retries_transient_failures_then_succeeds(): void
    {
        $this->needs('retry', 'netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 2, 'failStatus' => 503]],
            ['name' => 'retry', 'options' => [
                'retries' => 3, 'minDelay' => 10, 'jitter' => false, 'sleep' => $clock->sleep(),
            ]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        $this->assertSame(2, $h->client->_retry['attempts']);
    }

    public function test_retry_gives_up_after_the_budget(): void
    {
        $this->needs('retry', 'netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 9, 'failStatus' => 500]],
            ['name' => 'retry', 'options' => [
                'retries' => 2, 'minDelay' => 1, 'jitter' => false, 'sleep' => $clock->sleep(),
            ]],
        ]);
        $this->assertSame(500, $h->op(['op' => 'load'])['result']->status);
    }

    public function test_retry_does_not_retry_a_non_retryable_status(): void
    {
        $this->needs('retry');
        $rec = new FtRecorder(function (int $_n) { return FtHarness::response(404); });
        $h = new FtHarness([
            ['name' => 'retry', 'options' => ['retries' => 3, 'minDelay' => 0]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $this->assertCount(1, $rec->calls);
    }

    public function test_retry_retries_a_transport_error_until_exhausted(): void
    {
        $this->needs('retry');
        $clock = new FtClock();
        $n = 0;
        $server = function (ZefoyTiktokBotContext $ctx, string $_url, array $_fd) use (&$n): array {
            $n++;
            return [null, $ctx->make_error('boom', 'boom')];
        };
        $h = new FtHarness([
            ['name' => 'retry', 'options' => [
                'retries' => 2, 'minDelay' => 1, 'jitter' => false, 'sleep' => $clock->sleep(),
            ]],
        ], $server);
        $res = $h->op(['op' => 'load']);
        $this->assertFalse($res['ok']);
        $this->assertSame(3, $n);
        $this->assertSame('boom', self::code($res['err']));
    }

    public function test_retry_honours_a_server_retry_after(): void
    {
        $this->needs('retry', 'netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['rateLimitTimes' => 1, 'retryAfter' => 2]],
            ['name' => 'retry', 'options' => [
                'retries' => 2, 'minDelay' => 10, 'maxDelay' => 60000,
                'jitter' => false, 'sleep' => $clock->sleep(),
            ]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        $this->assertEquals(2000, $clock->t);
    }

    public function test_retry_inactive_does_not_wrap(): void
    {
        $this->needs('retry');
        $rec = new FtRecorder(function (int $_n) { return FtHarness::response(503); });
        $h = new FtHarness([
            ['name' => 'retry', 'options' => ['active' => false]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $this->assertCount(1, $rec->calls);
    }


    // --- timeout ------------------------------------------------------------

    public function test_timeout_a_slow_request_times_out(): void
    {
        $this->needs('timeout', 'netsim');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['latency' => 80, 'sleep' => $clock->sleep()]],
            ['name' => 'timeout', 'options' => ['ms' => 10, 'now' => $clock->now()]],
        ]);
        $res = $h->op(['op' => 'load']);
        $this->assertSame('timeout', self::code($res['err']));
        $this->assertSame(1, $h->client->_timeout['count']);
    }

    public function test_timeout_a_fast_request_passes_and_annotates(): void
    {
        $this->needs('timeout');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'timeout', 'options' => ['ms' => 1000]],
        ], $rec->server());
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        // The fetch definition carries the transport-level timeout hint.
        $this->assertEquals(1000, $rec->calls[0]['fetchdef']['timeout']);
    }

    public function test_timeout_zero_disables_the_deadline(): void
    {
        $this->needs('timeout');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'timeout', 'options' => ['ms' => 0]],
        ], $rec->server());
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
        $this->assertArrayNotHasKey('timeout', $rec->calls[0]['fetchdef']);
    }

    public function test_timeout_inactive_does_not_wrap(): void
    {
        $this->needs('timeout');
        $h = new FtHarness([
            ['name' => 'timeout', 'options' => ['active' => false]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
    }


    // --- ratelimit ----------------------------------------------------------

    public function test_ratelimit_throttles_once_the_burst_is_spent(): void
    {
        $this->needs('ratelimit');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'ratelimit', 'options' => [
                'rate' => 1, 'burst' => 2, 'now' => $clock->now(), 'sleep' => $clock->sleep(),
            ]],
        ]);
        $h->op(['op' => 'load']);
        $h->op(['op' => 'load']);
        $h->op(['op' => 'load']);
        $this->assertSame(1, $h->client->_ratelimit['throttled']);
        $this->assertTrue($clock->t > 0);
    }

    public function test_ratelimit_burst_defaults_to_rate_and_refills(): void
    {
        $this->needs('ratelimit');
        $clock = new FtClock();
        $h = new FtHarness([
            ['name' => 'ratelimit', 'options' => [
                'rate' => 2, 'now' => $clock->now(), 'sleep' => $clock->sleep(),
            ]],
        ]);
        $h->op(['op' => 'load']);
        $h->op(['op' => 'load']);
        $clock->advance(1000); // refill
        $h->op(['op' => 'load']);
        $this->assertFalse(isset($h->client->_ratelimit));
    }


    // --- cache --------------------------------------------------------------

    public function test_cache_serves_a_repeated_read_from_cache(): void
    {
        $this->needs('cache');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'cache', 'options' => ['ttl' => 10000]],
        ], $rec->server());
        $a = $h->op(['op' => 'load', 'path' => '/w/1']);
        $b = $h->op(['op' => 'load', 'path' => '/w/1']);
        $this->assertCount(1, $rec->calls);
        $this->assertEquals($a['data'], $b['data']);
        $this->assertSame(1, $h->client->_cache['hit']);
    }

    public function test_cache_does_not_cache_non_get(): void
    {
        $this->needs('cache');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'cache'],
        ], $rec->server());
        $h->op(['op' => 'create', 'path' => '/w']);
        $h->op(['op' => 'create', 'path' => '/w']);
        $this->assertCount(2, $rec->calls);
    }

    public function test_cache_does_not_cache_a_non_2xx(): void
    {
        $this->needs('cache');
        $rec = new FtRecorder(function (int $_n) { return FtHarness::response(500); });
        $h = new FtHarness([
            ['name' => 'cache'],
        ], $rec->server());
        $h->op(['op' => 'load', 'path' => '/w']);
        $h->op(['op' => 'load', 'path' => '/w']);
        $this->assertCount(2, $rec->calls);
        $this->assertSame(2, $h->client->_cache['bypass']);
    }

    public function test_cache_refetches_after_the_ttl(): void
    {
        $this->needs('cache');
        $clock = new FtClock();
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'cache', 'options' => ['ttl' => 1000, 'now' => $clock->now()]],
        ], $rec->server());
        $h->op(['op' => 'load', 'path' => '/w']);
        $clock->advance(1500);
        $h->op(['op' => 'load', 'path' => '/w']);
        $this->assertCount(2, $rec->calls);
    }

    public function test_cache_evicts_the_oldest_entry_past_max(): void
    {
        $this->needs('cache');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'cache', 'options' => ['ttl' => 10000, 'max' => 1]],
        ], $rec->server());
        $h->op(['op' => 'load', 'path' => '/a']);
        $h->op(['op' => 'load', 'path' => '/b']); // evicts /a
        $h->op(['op' => 'load', 'path' => '/a']); // miss again
        $this->assertCount(3, $rec->calls);
    }


    // --- idempotency ----------------------------------------------------------

    public function test_idempotency_adds_a_key_to_mutating_ops(): void
    {
        $this->needs('idempotency');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'idempotency'],
        ], $rec->server());
        $h->op(['op' => 'create', 'path' => '/w']);
        $this->assertNotNull($rec->calls[0]['fetchdef']['headers']['Idempotency-Key'] ?? null);
    }

    public function test_idempotency_adds_a_key_based_on_http_method(): void
    {
        $this->needs('idempotency');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'idempotency'],
        ], $rec->server());
        $h->op(['op' => 'act', 'method' => 'PUT', 'path' => '/w']);
        $this->assertNotNull($rec->calls[0]['fetchdef']['headers']['Idempotency-Key'] ?? null);
    }

    public function test_idempotency_leaves_reads_untouched(): void
    {
        $this->needs('idempotency');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'idempotency'],
        ], $rec->server());
        $h->op(['op' => 'load', 'path' => '/w/1']);
        $this->assertArrayNotHasKey('Idempotency-Key', $rec->calls[0]['fetchdef']['headers']);
    }

    public function test_idempotency_preserves_caller_key_and_custom_header(): void
    {
        $this->needs('idempotency');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'idempotency', 'options' => ['header' => 'X-Idem']],
        ], $rec->server());
        $h->op(['op' => 'create', 'path' => '/w', 'headers' => ['X-Idem' => 'caller-1']]);
        $this->assertSame('caller-1', $rec->calls[0]['fetchdef']['headers']['X-Idem']);
    }

    public function test_idempotency_injectable_keygen(): void
    {
        $this->needs('idempotency');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'idempotency', 'options' => ['keygen' => function () { return 'K-1'; }]],
        ], $rec->server());
        $h->op(['op' => 'create', 'path' => '/w']);
        $this->assertSame('K-1', $rec->calls[0]['fetchdef']['headers']['Idempotency-Key']);
        $this->assertSame('K-1', $h->client->_idempotency['last']);
    }


    // --- rbac -----------------------------------------------------------------

    public function test_rbac_denies_before_any_call(): void
    {
        $this->needs('rbac');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'rbac', 'options' => [
                'rules' => ['widget.remove' => 'admin'], 'permissions' => [],
            ]],
        ], $rec->server());
        $res = $h->op(['op' => 'remove', 'path' => '/w/1']);
        $this->assertSame('rbac_denied', self::code($res['err']));
        $this->assertCount(0, $rec->calls);
        $this->assertSame(1, $h->client->_rbac['denied']);
    }

    public function test_rbac_allows_a_held_permission(): void
    {
        $this->needs('rbac');
        $h = new FtHarness([
            ['name' => 'rbac', 'options' => [
                'rules' => ['widget.remove' => 'admin'], 'permissions' => ['admin'],
            ]],
        ]);
        $this->assertTrue($h->op(['op' => 'remove', 'path' => '/w/1'])['ok']);
    }

    public function test_rbac_rule_by_op_name_and_wildcard_grant(): void
    {
        $this->needs('rbac');
        $h = new FtHarness([
            ['name' => 'rbac', 'options' => [
                'rules' => ['load' => 'read'], 'permissions' => ['*'],
            ]],
        ]);
        $this->assertTrue($h->op(['op' => 'load'])['ok']);
    }

    public function test_rbac_no_rule_allows_by_default_and_deny_true_blocks(): void
    {
        $this->needs('rbac');
        $allow = new FtHarness([
            ['name' => 'rbac', 'options' => ['permissions' => []]],
        ]);
        $this->assertTrue($allow->op(['op' => 'load'])['ok']);

        $deny = new FtHarness([
            ['name' => 'rbac', 'options' => ['deny' => true, 'permissions' => []]],
        ]);
        $this->assertSame('rbac_denied', self::code($deny->op(['op' => 'load'])['err']));
    }


    // --- metrics --------------------------------------------------------------

    public function test_metrics_counts_ok_and_err_per_op(): void
    {
        $this->needs('metrics', 'netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 1, 'failStatus' => 500]],
            ['name' => 'metrics', 'options' => []],
        ]);
        $h->op(['op' => 'load']);
        $h->op(['op' => 'load']);
        $h->op(['op' => 'list']);
        $m = $h->client->_metrics;
        $this->assertSame(3, $m['total']['count']);
        $this->assertSame(2, $m['total']['ok']);
        $this->assertSame(1, $m['total']['err']);
        $this->assertSame(2, $m['ops']['widget.load']['count']);
    }

    public function test_metrics_injected_clock(): void
    {
        $this->needs('metrics');
        $t = 0;
        $h = new FtHarness([
            ['name' => 'metrics', 'options' => ['now' => function () use (&$t) { return $t += 10; }]],
        ]);
        $h->op(['op' => 'load']);
        $this->assertSame(1, $h->client->_metrics['total']['count']);
        $this->assertEquals(10, $h->client->_metrics['total']['totalMs']);
    }


    // --- telemetry ------------------------------------------------------------

    public function test_telemetry_opens_spans_and_propagates_trace_headers(): void
    {
        $this->needs('telemetry');
        $rec = new FtRecorder();
        $spans = [];
        $h = new FtHarness([
            ['name' => 'telemetry', 'options' => [
                'exporter' => function ($s) use (&$spans) { $spans[] = $s; },
            ]],
        ], $rec->server());
        $res = $h->op(['op' => 'load']);
        $this->assertTrue($res['ok']);
        $this->assertCount(1, $h->client->_telemetry['spans']);
        $this->assertCount(1, $spans);
        $sent = $rec->calls[0]['fetchdef']['headers'];
        $this->assertSame($h->client->_telemetry['spans'][0]['traceId'], $sent['X-Trace-Id']);
        $this->assertMatchesRegularExpression('/^00-.+-.+-01$/', $sent['traceparent']);
    }

    public function test_telemetry_records_a_failed_span_on_error(): void
    {
        $this->needs('telemetry', 'netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 1, 'failStatus' => 500]],
            ['name' => 'telemetry', 'options' => []],
        ]);
        $h->op(['op' => 'load']);
        $this->assertFalse($h->client->_telemetry['spans'][0]['ok']);
    }

    public function test_telemetry_injected_idgen_and_clock(): void
    {
        $this->needs('telemetry');
        $h = new FtHarness([
            ['name' => 'telemetry', 'options' => [
                'idgen' => function (string $k) { return $k . '-X'; },
                'now' => function () { return 5; },
            ]],
        ]);
        $h->op(['op' => 'load']);
        $span = $h->client->_telemetry['spans'][0];
        $this->assertSame('trace-X', $span['traceId']);
        $this->assertEquals(0, $span['durationMs']);
    }


    // --- debug ----------------------------------------------------------------

    public function test_debug_captures_redacted_trace_and_honours_on_entry_and_max(): void
    {
        $this->needs('debug');
        $seen = [];
        $h = new FtHarness([
            ['name' => 'debug', 'options' => [
                'max' => 1, 'onEntry' => function ($e) use (&$seen) { $seen[] = $e; },
            ]],
        ]);
        $h->op(['op' => 'load', 'headers' => ['authorization' => 'Bearer secret']]);
        $h->op(['op' => 'list']);
        $this->assertCount(1, $h->client->_debug['entries']); // ring buffer capped at max
        $this->assertCount(2, $seen);
        $this->assertSame('<redacted>', $seen[0]['headers']['authorization']);
    }

    public function test_debug_captures_failures(): void
    {
        $this->needs('debug', 'netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 1, 'failStatus' => 500]],
            ['name' => 'debug', 'options' => []],
        ]);
        $h->op(['op' => 'load']);
        $this->assertFalse($h->client->_debug['entries'][0]['ok']);
        $this->assertSame(500, $h->client->_debug['entries'][0]['status']);
    }

    public function test_debug_injected_clock_and_custom_redact(): void
    {
        $this->needs('debug');
        $h = new FtHarness([
            ['name' => 'debug', 'options' => [
                'now' => function () { return 7; }, 'redact' => ['x-secret'],
            ]],
        ]);
        $h->op(['op' => 'load', 'headers' => ['x-secret' => 'hide', 'x-ok' => 'show']]);
        $e = $h->client->_debug['entries'][0];
        $this->assertSame('<redacted>', $e['headers']['x-secret']);
        $this->assertSame('show', $e['headers']['x-ok']);
    }


    // --- audit ----------------------------------------------------------------

    public function test_audit_one_record_per_op_with_sink_and_actor(): void
    {
        $this->needs('audit', 'netsim');
        $sink = [];
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failTimes' => 1, 'failStatus' => 500]],
            ['name' => 'audit', 'options' => [
                'actor' => 'svc', 'max' => 5,
                'sink' => function ($r) use (&$sink) { $sink[] = $r; },
            ]],
        ]);
        $h->op(['op' => 'remove', 'path' => '/w/1']);
        $h->op(['op' => 'load', 'ctrl' => ['actor' => 'per-call']]);
        $recs = $h->client->_audit['records'];
        $this->assertCount(2, $recs);
        $this->assertSame('error', $recs[0]['outcome']);
        $this->assertSame('svc', $recs[0]['actor']);
        $this->assertSame('per-call', $recs[1]['actor']);
        $this->assertCount(2, $sink);
        $this->assertNotSame('', (string)$recs[0]['correlationId']);
    }

    public function test_audit_default_actor_and_injected_clock(): void
    {
        $this->needs('audit');
        $h = new FtHarness([
            ['name' => 'audit', 'options' => ['now' => function () { return 42; }]],
        ]);
        $h->op(['op' => 'load']);
        $rec = $h->client->_audit['records'][0];
        $this->assertSame('anonymous', $rec['actor']);
        $this->assertEquals(42, $rec['ts']);
    }


    // --- clienttrack ----------------------------------------------------------

    public function test_clienttrack_stable_client_id_unique_request_ids_ua(): void
    {
        $this->needs('clienttrack');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'clienttrack', 'options' => [
                'clientName' => 'Acme', 'clientVersion' => '2.0.0',
            ]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $h->op(['op' => 'load']);
        $h0 = $rec->calls[0]['fetchdef']['headers'];
        $h1 = $rec->calls[1]['fetchdef']['headers'];
        $this->assertSame('Acme/2.0.0', $h0['User-Agent']);
        $this->assertSame($h0['X-Client-Id'], $h1['X-Client-Id']);
        $this->assertNotSame($h0['X-Request-Id'], $h1['X-Request-Id']);
        $this->assertSame(2, $h->client->_clienttrack['requests']);
    }

    public function test_clienttrack_does_not_clobber_a_caller_user_agent(): void
    {
        $this->needs('clienttrack');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'clienttrack'],
        ], $rec->server());
        $h->op(['op' => 'load', 'headers' => ['User-Agent' => 'mine']]);
        $this->assertSame('mine', $rec->calls[0]['fetchdef']['headers']['User-Agent']);
    }

    public function test_clienttrack_injected_idgen_and_fixed_session(): void
    {
        $this->needs('clienttrack');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'clienttrack', 'options' => [
                'sessionId' => 'S1', 'idgen' => function (string $k) { return $k . '-1'; },
            ]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $this->assertSame('S1', $rec->calls[0]['fetchdef']['headers']['X-Client-Id']);
        $this->assertSame('request-1', $rec->calls[0]['fetchdef']['headers']['X-Request-Id']);
    }


    // --- paging ---------------------------------------------------------------

    public function test_paging_stamps_page_limit_and_reads_header_signals(): void
    {
        $this->needs('paging');
        $rec = new FtRecorder(function (int $_n) {
            return FtHarness::response(200, ['items' => [1, 2]], [
                'x-next-page' => '2',
                'x-total-count' => '5',
                'link' => '</w?page=2>; rel="next"',
            ]);
        });
        $h = new FtHarness([
            ['name' => 'paging', 'options' => ['limit' => 2]],
        ], $rec->server());
        $res = $h->op(['op' => 'list', 'path' => '/w']);
        $this->assertStringContainsString('page=1', $rec->calls[0]['url']);
        $this->assertStringContainsString('limit=2', $rec->calls[0]['url']);
        $paging = $res['result']->paging;
        $this->assertEquals(2, $paging['nextPage']);
        $this->assertEquals(5, $paging['totalCount']);
        $this->assertSame('/w?page=2', $paging['next']);
        $this->assertTrue($paging['hasMore']);
    }

    public function test_paging_body_cursor_and_explicit_cursor_request(): void
    {
        $this->needs('paging');
        $rec = new FtRecorder(function (int $_n) {
            return FtHarness::response(200, ['nextCursor' => 'abc', 'hasMore' => true]);
        });
        $h = new FtHarness([
            ['name' => 'paging'],
        ], $rec->server());
        $res = $h->op(['op' => 'list', 'path' => '/w', 'ctrl' => ['paging' => ['cursor' => 'xyz']]]);
        $this->assertStringContainsString('cursor=xyz', $rec->calls[0]['url']);
        $this->assertSame('abc', $res['result']->paging['cursor']);
        $this->assertTrue($res['result']->paging['hasMore']);
    }

    public function test_paging_non_list_op_is_not_paged(): void
    {
        $this->needs('paging');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'paging'],
        ], $rec->server());
        $h->op(['op' => 'load', 'path' => '/w/1']);
        $this->assertStringNotContainsString('page=', $rec->calls[0]['url']);
    }


    // --- streaming ------------------------------------------------------------

    public function test_streaming_streams_list_items(): void
    {
        $this->needs('streaming');
        $clock = new FtClock();
        $rec = new FtRecorder(function (int $_n) {
            return FtHarness::response(200, ['a', 'b', 'c']);
        });
        $h = new FtHarness([
            ['name' => 'streaming', 'options' => ['chunkDelay' => 5, 'sleep' => $clock->sleep()]],
        ], $rec->server());
        $res = $h->op(['op' => 'list', 'path' => '/w']);
        $this->assertTrue($res['result']->streaming);
        $seen = [];
        foreach (($res['result']->stream)() as $item) {
            $seen[] = $item;
        }
        $this->assertSame(['a', 'b', 'c'], $seen);
        $this->assertEquals(15, $clock->t);
        $this->assertSame(1, $h->client->_streaming['opened']);
    }

    public function test_streaming_batches_with_chunk_size(): void
    {
        $this->needs('streaming');
        $rec = new FtRecorder(function (int $_n) {
            return FtHarness::response(200, [1, 2, 3, 4, 5]);
        });
        $h = new FtHarness([
            ['name' => 'streaming', 'options' => ['chunkSize' => 2]],
        ], $rec->server());
        $res = $h->op(['op' => 'list', 'path' => '/w']);
        $batches = [];
        foreach (($res['result']->stream)() as $b) {
            $batches[] = $b;
        }
        $this->assertSame([[1, 2], [3, 4], [5]], $batches);
    }

    public function test_streaming_non_list_op_is_not_streamed(): void
    {
        $this->needs('streaming');
        $h = new FtHarness([
            ['name' => 'streaming'],
        ]);
        $res = $h->op(['op' => 'load']);
        $this->assertFalse($res['result']->streaming);
    }


    // --- proxy ----------------------------------------------------------------

    public function test_proxy_routes_through_proxy_and_invokes_agent_factory(): void
    {
        $this->needs('proxy');
        $rec = new FtRecorder();
        $agent_url = '';
        $h = new FtHarness([
            ['name' => 'proxy', 'options' => [
                'url' => 'http://proxy:8080',
                'agent' => function (string $u) use (&$agent_url) {
                    $agent_url = $u;
                    return ['a' => 1];
                },
            ]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $this->assertSame('http://proxy:8080', $rec->calls[0]['fetchdef']['proxy']);
        $this->assertSame(1, $rec->calls[0]['fetchdef']['dispatcher']['a']);
        $this->assertSame('http://proxy:8080', $agent_url);
        $this->assertSame(1, $h->client->_proxy['routed']);
    }

    public function test_proxy_bypasses_no_proxy_hosts(): void
    {
        $this->needs('proxy');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'proxy', 'options' => [
                'url' => 'http://proxy:8080', 'noProxy' => ['api.test'],
            ]],
        ], $rec->server(), 'http://api.test');
        $h->op(['op' => 'load']);
        $this->assertArrayNotHasKey('proxy', $rec->calls[0]['fetchdef']);
    }

    public function test_proxy_from_env_reads_https_proxy(): void
    {
        $this->needs('proxy');
        $prev = getenv('HTTPS_PROXY');
        putenv('HTTPS_PROXY=http://env-proxy:8080');
        try {
            $rec = new FtRecorder();
            $h = new FtHarness([
                ['name' => 'proxy', 'options' => ['fromEnv' => true]],
            ], $rec->server());
            $h->op(['op' => 'load']);
            $this->assertSame('http://env-proxy:8080', $rec->calls[0]['fetchdef']['proxy']);
        } finally {
            if ($prev === false) {
                putenv('HTTPS_PROXY');
            } else {
                putenv('HTTPS_PROXY=' . $prev);
            }
        }
    }

    public function test_proxy_inactive_or_no_url_is_a_no_op(): void
    {
        $this->needs('proxy');
        $rec = new FtRecorder();
        $h = new FtHarness([
            ['name' => 'proxy', 'options' => ['active' => false]],
        ], $rec->server());
        $h->op(['op' => 'load']);
        $this->assertArrayNotHasKey('proxy', $rec->calls[0]['fetchdef']);

        $rec2 = new FtRecorder();
        $h2 = new FtHarness([
            ['name' => 'proxy', 'options' => []],
        ], $rec2->server());
        $h2->op(['op' => 'load']);
        $this->assertArrayNotHasKey('proxy', $rec2->calls[0]['fetchdef']);
    }


    // --- composition ------------------------------------------------------------

    public function test_cache_plus_netsim_a_hit_skips_the_simulated_failure(): void
    {
        $this->needs('cache', 'netsim');
        $h = new FtHarness([
            ['name' => 'netsim', 'options' => ['failEvery' => 2]],
            ['name' => 'cache', 'options' => ['ttl' => 10000]],
        ]);
        $this->assertTrue($h->op(['op' => 'load', 'path' => '/w'])['ok']);
        $this->assertTrue($h->op(['op' => 'load', 'path' => '/w'])['ok']);
        $this->assertSame(1, $h->client->_netsim['calls']);
    }
}
