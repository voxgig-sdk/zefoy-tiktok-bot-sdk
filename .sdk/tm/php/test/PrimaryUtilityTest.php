<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK primary utility test

require_once __DIR__ . '/../projectname_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;
use Voxgig\Struct\Struct;

class PrimaryUtilityTest extends TestCase
{
    private static ?array $test_spec = null;

    private static function load_test_spec(): array
    {
        if (self::$test_spec !== null) {
            return self::$test_spec;
        }
        $path = __DIR__ . '/../../.sdk/test/test.json';
        $content = file_get_contents($path);
        if ($content === false) {
            throw new RuntimeException("Failed to load test.json: $path");
        }
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException("Failed to parse test.json: " . json_last_error_msg());
        }
        self::$test_spec = $data;
        return $data;
    }

    private static function get_spec(?array $spec, string ...$keys): ?array
    {
        $cur = $spec;
        foreach ($keys as $key) {
            if (!is_array($cur) || !array_key_exists($key, $cur)) {
                return null;
            }
            $cur = $cur[$key];
        }
        return is_array($cur) ? $cur : null;
    }

    private function runset(?array $testspec, callable $subject): void
    {
        if ($testspec === null || !isset($testspec['set']) || !is_array($testspec['set'])) {
            return;
        }
        $set = $testspec['set'];

        foreach ($set as $i => $entry) {
            if (!is_array($entry)) {
                continue;
            }

            $mark = '';
            if (isset($entry['mark'])) {
                $mark = " (mark={$entry['mark']})";
            }

            $result = null;
            $err = null;

            try {
                [$result, $err] = $subject($entry);
            } catch (\Throwable $e) {
                $err = $e;
            }

            $expected_err = $entry['err'] ?? null;

            if ($err !== null) {
                if ($expected_err !== null) {
                    $err_msg = ($err instanceof \Throwable) ? $err->getMessage() : (string)$err;
                    if (is_string($expected_err)) {
                        $this->assertTrue(
                            $this->match_string($expected_err, $err_msg),
                            "entry {$i}{$mark}: error mismatch: got \"{$err_msg}\", want contains \"{$expected_err}\""
                        );
                    }
                    // err: true means any error is acceptable

                    if (isset($entry['match']) && is_array($entry['match'])) {
                        $result_map = [
                            'in' => $entry['in'] ?? null,
                            'out' => $this->json_normalize($result),
                            'err' => ['message' => ($err instanceof \Throwable) ? $err->getMessage() : (string)$err],
                        ];
                        $this->match_deep($i, $mark, $entry['match'], $result_map, '');
                    }
                    continue;
                }
                $err_msg = ($err instanceof \Throwable) ? $err->getMessage() : (string)$err;
                $this->fail("entry {$i}{$mark}: unexpected error: {$err_msg}");
                continue;
            }

            if ($expected_err !== null) {
                $this->fail(
                    "entry {$i}{$mark}: expected error containing \"{$expected_err}\" but got result: "
                    . json_encode($result)
                );
                continue;
            }

            $matched = false;
            if (isset($entry['match']) && is_array($entry['match'])) {
                $result_map = [
                    'in' => $entry['in'] ?? null,
                    'out' => $this->json_normalize($result),
                ];
                if (isset($entry['args'])) {
                    $result_map['args'] = $entry['args'];
                } elseif (isset($entry['in'])) {
                    $result_map['args'] = [$entry['in']];
                }
                if (isset($entry['ctx'])) {
                    $result_map['ctx'] = $entry['ctx'];
                }
                $this->match_deep($i, $mark, $entry['match'], $result_map, '');
                $this->assertTrue(true, "entry {$i}{$mark}: match completed");
                $matched = true;
            }

            $expected_out = $entry['out'] ?? null;
            if ($expected_out === null && $matched) {
                continue;
            }
            if ($expected_out !== null) {
                $norm_result = $this->json_normalize($result);
                $norm_expected = $this->json_normalize($expected_out);
                $this->assertEquals(
                    $norm_expected,
                    $norm_result,
                    "entry {$i}{$mark}: output mismatch"
                );
            }
        }
    }

    private function json_normalize(mixed $val): mixed
    {
        if ($val === null) {
            return null;
        }
        $j = json_encode($val);
        if ($j === false) {
            return $val;
        }
        return json_decode($j, true);
    }

    private function match_deep(int $entry_idx, string $mark, mixed $check, mixed $base, string $path): void
    {
        if ($check === null) {
            return;
        }

        if (is_array($check) && !$this->is_list($check)) {
            // Associative array (map)
            foreach ($check as $key => $check_val) {
                $child_path = $path . '.' . $key;
                $base_val = null;
                if (is_array($base) && array_key_exists($key, $base)) {
                    $base_val = $base[$key];
                }
                $this->match_deep($entry_idx, $mark, $check_val, $base_val, $child_path);
            }
        } elseif (is_array($check) && $this->is_list($check)) {
            // Indexed array (list)
            foreach ($check as $i => $check_val) {
                $child_path = $path . "[{$i}]";
                $base_val = null;
                if (is_array($base) && isset($base[$i])) {
                    $base_val = $base[$i];
                }
                $this->match_deep($entry_idx, $mark, $check_val, $base_val, $child_path);
            }
        } else {
            if (is_string($check) && $check === '__EXISTS__') {
                $this->assertNotNull(
                    $base,
                    "entry {$entry_idx}{$mark}: match {$path}: expected value to exist but got null"
                );
                return;
            }
            if (is_string($check) && $check === '__UNDEF__') {
                $this->assertNull(
                    $base,
                    "entry {$entry_idx}{$mark}: match {$path}: expected null but got " . json_encode($base)
                );
                return;
            }

            $norm_check = $this->json_normalize($check);
            $norm_base = $this->json_normalize($base);

            if ($norm_check !== $norm_base) {
                if (is_string($check) && $check !== '') {
                    $base_str = Struct::stringify($base);
                    if ($this->match_string($check, $base_str)) {
                        return;
                    }
                }
                $this->assertEquals(
                    $norm_check,
                    $norm_base,
                    "entry {$entry_idx}{$mark}: match {$path}"
                );
            }
        }
    }

    private function match_string(string $pattern, string $val): bool
    {
        if (strlen($pattern) >= 2 && $pattern[0] === '/' && $pattern[strlen($pattern) - 1] === '/') {
            $re = substr($pattern, 1, -1);
            return (bool)preg_match('/' . $re . '/', $val);
        }
        return str_contains(strtolower($val), strtolower($pattern));
    }

    private function is_list(array $arr): bool
    {
        if (empty($arr)) {
            return true;
        }
        return array_keys($arr) === range(0, count($arr) - 1);
    }

    private static function make_ctx_from_map(
        ?array $ctxmap,
        ZefoyTiktokBotSDK $client,
        ZefoyTiktokBotUtility $utility
    ): ZefoyTiktokBotContext {
        if ($ctxmap === null) {
            $ctxmap = [];
        }

        $ctx = new ZefoyTiktokBotContext($ctxmap, null);

        $ctx->client = $client;
        $ctx->utility = $utility;

        if ($ctx->options === null) {
            $ctx->options = $client->options_map();
        }

        // Handle spec from JSON map
        if (isset($ctxmap['spec']) && is_array($ctxmap['spec'])) {
            $ctx->spec = new ZefoyTiktokBotSpec($ctxmap['spec']);
        }

        // Handle result from JSON map
        if (isset($ctxmap['result']) && is_array($ctxmap['result'])) {
            $ctx->result = new ZefoyTiktokBotResult($ctxmap['result']);
            if (isset($ctxmap['result']['err']) && is_array($ctxmap['result']['err'])) {
                $msg = $ctxmap['result']['err']['message'] ?? '';
                $ctx->result->err = new ZefoyTiktokBotError('', $msg);
            }
        }

        // Handle response from JSON map
        if (isset($ctxmap['response']) && is_array($ctxmap['response'])) {
            $ctx->response = new ZefoyTiktokBotResponse($ctxmap['response']);
            if (isset($ctxmap['response']['body'])) {
                $body_copy = $ctxmap['response']['body'];
                $ctx->response->json_func = function () use ($body_copy) { return $body_copy; };
                $ctx->response->body = $body_copy;
            }
            if (isset($ctxmap['response']['headers']) && is_array($ctxmap['response']['headers'])) {
                $lower_headers = [];
                foreach ($ctxmap['response']['headers'] as $k => $v) {
                    $lower_headers[strtolower($k)] = $v;
                }
                $ctx->response->headers = $lower_headers;
            }
        }

        return $ctx;
    }

    private static function fixctx(ZefoyTiktokBotContext $ctx, ZefoyTiktokBotSDK $client): void
    {
        if ($ctx->client !== null && $ctx->options === null) {
            $ctx->options = $ctx->client->options_map();
        }
    }

    private static function err_from_map(?array $m): ?ZefoyTiktokBotError
    {
        if ($m === null) {
            return null;
        }
        $msg = $m['message'] ?? '';
        if ($msg === '') {
            return null;
        }
        $code = $m['code'] ?? '';
        return new ZefoyTiktokBotError($code, $msg);
    }

    private static function make_test_ctx(
        ZefoyTiktokBotSDK $client,
        ZefoyTiktokBotUtility $utility,
        ?array $overrides = null
    ): ZefoyTiktokBotContext {
        $ctxmap = [
            'opname' => 'load',
            'client' => $client,
            'utility' => $utility,
        ];
        if ($overrides !== null) {
            foreach ($overrides as $k => $v) {
                $ctxmap[$k] = $v;
            }
        }
        return ($utility->make_context)($ctxmap, $client->get_root_ctx());
    }

    private static function make_test_full_ctx(
        ZefoyTiktokBotSDK $client,
        ZefoyTiktokBotUtility $utility
    ): ZefoyTiktokBotContext {
        $ctx = self::make_test_ctx($client, $utility);
        $ctx->point = [
            'parts' => ['items', '{id}'],
            'args' => ['params' => [['name' => 'id', 'reqd' => true]]],
            'params' => ['id'],
            'alias' => [],
            'select' => [],
            'active' => true,
            'transform' => [],
        ];
        $ctx->match = ['id' => 'item01'];
        $ctx->reqmatch = ['id' => 'item01'];
        return $ctx;
    }


    // === Test: exists ===

    public function test_exists(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->assertNotNull($utility->clean, 'clean should not be null');
        $this->assertNotNull($utility->done, 'done should not be null');
        $this->assertNotNull($utility->make_error, 'make_error should not be null');
        $this->assertNotNull($utility->feature_add, 'feature_add should not be null');
        $this->assertNotNull($utility->feature_hook, 'feature_hook should not be null');
        $this->assertNotNull($utility->feature_init, 'feature_init should not be null');
        $this->assertNotNull($utility->fetcher, 'fetcher should not be null');
        $this->assertNotNull($utility->make_fetch_def, 'make_fetch_def should not be null');
        $this->assertNotNull($utility->make_context, 'make_context should not be null');
        $this->assertNotNull($utility->make_options, 'make_options should not be null');
        $this->assertNotNull($utility->make_request, 'make_request should not be null');
        $this->assertNotNull($utility->make_response, 'make_response should not be null');
        $this->assertNotNull($utility->make_result, 'make_result should not be null');
        $this->assertNotNull($utility->make_point, 'make_point should not be null');
        $this->assertNotNull($utility->make_spec, 'make_spec should not be null');
        $this->assertNotNull($utility->make_url, 'make_url should not be null');
        $this->assertNotNull($utility->param, 'param should not be null');
        $this->assertNotNull($utility->prepare_auth, 'prepare_auth should not be null');
        $this->assertNotNull($utility->prepare_body, 'prepare_body should not be null');
        $this->assertNotNull($utility->prepare_headers, 'prepare_headers should not be null');
        $this->assertNotNull($utility->prepare_method, 'prepare_method should not be null');
        $this->assertNotNull($utility->prepare_params, 'prepare_params should not be null');
        $this->assertNotNull($utility->prepare_path, 'prepare_path should not be null');
        $this->assertNotNull($utility->prepare_query, 'prepare_query should not be null');
        $this->assertNotNull($utility->result_basic, 'result_basic should not be null');
        $this->assertNotNull($utility->result_body, 'result_body should not be null');
        $this->assertNotNull($utility->result_headers, 'result_headers should not be null');
        $this->assertNotNull($utility->transform_request, 'transform_request should not be null');
        $this->assertNotNull($utility->transform_response, 'transform_response should not be null');
    }


    // === Test: clean-basic ===

    public function test_clean_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $val = ['key' => 'secret123', 'name' => 'test'];
        $cleaned = ($utility->clean)($ctx, $val);
        $this->assertNotNull($cleaned, 'cleaned should not be null');
    }


    // === Test: done-basic ===

    public function test_done_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'done', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            self::fixctx($ctx, $client);
            return ($utility->done)($ctx);
        });
    }


    // === Test: makeError-basic ===

    public function test_make_error_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeError', 'basic'), function (array $entry) use ($client, $utility) {
            $args = $entry['args'] ?? [];
            if (empty($args)) {
                $args = [[]];
            }

            $ctxmap = $args[0] ?? [];
            if (!is_array($ctxmap)) {
                $ctxmap = [];
            }
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            self::fixctx($ctx, $client);

            $err = null;
            if (count($args) > 1 && is_array($args[1])) {
                $err = self::err_from_map($args[1]);
            }

            return ($utility->make_error)($ctx, $err);
        });
    }


    // === Test: makeError-no-throw ===

    public function test_make_error_no_throw(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->ctrl->throw_err = false;
        $ctx->result = new ZefoyTiktokBotResult([
            'ok' => false,
            'resdata' => ['id' => 'safe01'],
        ]);

        [$out, $err] = ($utility->make_error)($ctx, $ctx->make_error('test_code', 'test message'));
        $this->assertNull($err, 'expected no error');
        $this->assertIsArray($out);
        $this->assertEquals('safe01', $out['id']);
    }


    // === Test: featureAdd-basic ===

    public function test_feature_add_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $start_len = count($client->features);

        $feature = new ZefoyTiktokBotBaseFeature();
        ($utility->feature_add)($ctx, $feature);

        $this->assertEquals($start_len + 1, count($client->features));
    }


    // === Test: featureHook-basic ===

    public function test_feature_hook_basic(): void
    {
        $hook_client = ZefoyTiktokBotSDK::test(null, null);
        $hook_utility = $hook_client->get_utility();
        $ctx = self::make_test_ctx($hook_client, $hook_utility);

        $called = false;
        $hook_feature = new class extends ZefoyTiktokBotBaseFeature {
            public $hook_fn = null;
            public function TestHook(ZefoyTiktokBotContext $ctx): void
            {
                if ($this->hook_fn !== null) {
                    ($this->hook_fn)();
                }
            }
        };
        $hook_feature->hook_fn = function () use (&$called) { $called = true; };
        $hook_client->features = [$hook_feature];

        ($hook_utility->feature_hook)($ctx, 'TestHook');
        $this->assertTrue($called, 'expected TestHook to be called');
    }


    // === Test: featureInit-basic ===

    public function test_feature_init_basic(): void
    {
        $init_client = ZefoyTiktokBotSDK::test(null, null);
        $init_utility = $init_client->get_utility();
        $ctx = self::make_test_ctx($init_client, $init_utility);
        $ctx->options['feature'] = [
            'initfeat' => ['active' => true],
        ];

        $init_called = false;
        $feature = new class extends ZefoyTiktokBotBaseFeature {
            public $init_fn = null;
            public function __construct()
            {
                parent::__construct();
                $this->name = 'initfeat';
                $this->active = true;
            }
            public function init(ZefoyTiktokBotContext $ctx, array $options): void
            {
                if ($this->init_fn !== null) {
                    ($this->init_fn)();
                }
            }
        };
        $feature->init_fn = function () use (&$init_called) { $init_called = true; };

        ($init_utility->feature_init)($ctx, $feature);
        $this->assertTrue($init_called, 'expected init to be called');
    }


    // === Test: featureInit-inactive ===

    public function test_feature_init_inactive(): void
    {
        $init_client = ZefoyTiktokBotSDK::test(null, null);
        $init_utility = $init_client->get_utility();
        $ctx = self::make_test_ctx($init_client, $init_utility);
        $ctx->options['feature'] = [
            'nofeat' => ['active' => false],
        ];

        $init_called = false;
        $feature = new class extends ZefoyTiktokBotBaseFeature {
            public $init_fn = null;
            public function __construct()
            {
                parent::__construct();
                $this->name = 'nofeat';
                $this->active = false;
            }
            public function init(ZefoyTiktokBotContext $ctx, array $options): void
            {
                if ($this->init_fn !== null) {
                    ($this->init_fn)();
                }
            }
        };
        $feature->init_fn = function () use (&$init_called) { $init_called = true; };

        ($init_utility->feature_init)($ctx, $feature);
        $this->assertFalse($init_called, 'expected init NOT to be called for inactive feature');
    }


    // === Test: fetcher-live ===

    public function test_fetcher_live(): void
    {
        $calls = [];
        $live_client = new ZefoyTiktokBotSDK([
            'system' => [
                'fetch' => function (string $url, array $fetchdef) use (&$calls) {
                    $calls[] = ['url' => $url, 'init' => $fetchdef];
                    return [['status' => 200, 'statusText' => 'OK'], null];
                },
            ],
        ]);
        $live_utility = $live_client->get_utility();
        $ctx = ($live_utility->make_context)([
            'opname' => 'load',
            'client' => $live_client,
            'utility' => $live_utility,
        ], null);

        $fetchdef = ['method' => 'GET', 'headers' => []];
        [$_, $err] = ($live_utility->fetcher)($ctx, 'http://example.com/test', $fetchdef);
        $this->assertNull($err, 'expected no error');
        $this->assertCount(1, $calls, 'expected 1 call');
        $this->assertEquals('http://example.com/test', $calls[0]['url']);
    }


    // === Test: fetcher-blocked-test-mode ===

    public function test_fetcher_blocked_test_mode(): void
    {
        $blocked_client = new ZefoyTiktokBotSDK([
            'system' => [
                'fetch' => function (string $url, array $fetchdef) {
                    return [[], null];
                },
            ],
        ]);
        $blocked_client->mode = 'test';

        $blocked_utility = $blocked_client->get_utility();
        $ctx = ($blocked_utility->make_context)([
            'opname' => 'load',
            'client' => $blocked_client,
            'utility' => $blocked_utility,
        ], null);

        $fetchdef = ['method' => 'GET', 'headers' => []];
        [$_, $err] = ($blocked_utility->fetcher)($ctx, 'http://example.com/test', $fetchdef);
        $this->assertNotNull($err, 'expected error for test mode fetch');
        $err_msg = ($err instanceof \Throwable) ? $err->getMessage() : (string)$err;
        $this->assertTrue(
            str_contains(strtolower($err_msg), 'blocked'),
            "expected error containing 'blocked', got: {$err_msg}"
        );
    }


    // === Test: makeContext-basic ===

    public function test_make_context_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeContext', 'basic'), function (array $entry) use ($client, $utility) {
            $in = $entry['in'] ?? null;
            if (is_array($in)) {
                $ctx = ($utility->make_context)($in, null);
                $out = [
                    'id' => $ctx->id,
                ];
                if ($ctx->op !== null) {
                    $out['op'] = [
                        'name' => $ctx->op->name,
                        'input' => $ctx->op->input,
                    ];
                }
                return [$out, null];
            }
            return [null, null];
        });
    }


    // === Test: makeFetchDef-basic ===

    public function test_make_fetch_def_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new ZefoyTiktokBotSpec([
            'base' => 'http://localhost:8080',
            'prefix' => '/api',
            'path' => 'items/{id}',
            'suffix' => '',
            'params' => ['id' => 'item01'],
            'query' => [],
            'headers' => ['content-type' => 'application/json'],
            'method' => 'GET',
            'step' => 'start',
        ]);
        $ctx->result = new ZefoyTiktokBotResult([]);

        [$fetchdef, $err] = ($utility->make_fetch_def)($ctx);
        $this->assertNull($err, 'should not be error');
        $this->assertNotNull($fetchdef);
        $this->assertEquals('GET', $fetchdef['method']);
        $url = $fetchdef['url'] ?? '';
        $this->assertTrue(str_contains($url, '/api/items/item01'), "expected url to contain /api/items/item01, got {$url}");
        $this->assertEquals('application/json', $fetchdef['headers']['content-type']);
        $this->assertArrayNotHasKey('body', $fetchdef);
    }


    // === Test: makeFetchDef-with-body ===

    public function test_make_fetch_def_with_body(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new ZefoyTiktokBotSpec([
            'base' => 'http://localhost:8080',
            'prefix' => '',
            'path' => 'items',
            'suffix' => '',
            'params' => [],
            'query' => [],
            'headers' => [],
            'method' => 'POST',
            'step' => 'start',
            'body' => ['name' => 'test'],
        ]);
        $ctx->result = new ZefoyTiktokBotResult([]);

        [$fetchdef, $err] = ($utility->make_fetch_def)($ctx);
        $this->assertNull($err, 'should not be error');
        $this->assertNotNull($fetchdef);
        $this->assertEquals('POST', $fetchdef['method']);
        $body_str = $fetchdef['body'] ?? null;
        $this->assertIsString($body_str, 'expected body string');
        $this->assertTrue(str_contains($body_str, '"name"'), "expected body to contain name, got {$body_str}");
    }


    // === Test: makeOptions-basic ===

    public function test_make_options_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeOptions', 'basic'), function (array $entry) use ($client, $utility) {
            $in = $entry['in'] ?? [];
            $ctx = ($utility->make_context)([
                'options' => $in['options'] ?? null,
                'config' => $in['config'] ?? null,
            ], null);
            $ctx->client = $client;
            $ctx->utility = $utility;
            return [($utility->make_options)($ctx), null];
        });
    }


    // === Test: makeRequest-basic ===

    public function test_make_request_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeRequest', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            $ctx->options = $client->options_map();

            [$_, $err] = ($utility->make_request)($ctx);

            // Update entry ctx for match checking
            if ($ctx->response !== null) {
                $entry['ctx']['response'] = 'exists';
            }
            if ($ctx->result !== null) {
                $entry['ctx']['result'] = 'exists';
            }

            return [null, $err];
        });
    }


    // === Test: makeResponse-basic ===

    public function test_make_response_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeResponse', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            self::fixctx($ctx, $client);

            [$_, $err] = ($utility->make_response)($ctx);

            // Update entry ctx for match with result data
            if ($ctx->result !== null) {
                $entry['ctx']['result'] = [
                    'ok' => $ctx->result->ok,
                    'status' => $ctx->result->status,
                    'statusText' => $ctx->result->status_text,
                    'headers' => $ctx->result->headers,
                    'body' => $ctx->result->body,
                ];
            }

            return [null, $err];
        });
    }


    // === Test: makeResult-basic ===

    public function test_make_result_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new ZefoyTiktokBotSpec([
            'base' => 'http://localhost:8080',
            'prefix' => '/api',
            'path' => 'items/{id}',
            'suffix' => '',
            'params' => ['id' => 'item01'],
            'query' => [],
            'headers' => [],
            'method' => 'GET',
            'step' => 'start',
        ]);
        $ctx->result = new ZefoyTiktokBotResult([
            'ok' => true,
            'status' => 200,
            'statusText' => 'OK',
            'headers' => [],
            'resdata' => ['id' => 'item01', 'name' => 'Test'],
        ]);

        [$result, $err] = ($utility->make_result)($ctx);
        $this->assertNull($err, 'expected no error');
        $this->assertNotNull($result);
        $this->assertEquals(200, $result->status);
    }


    // === Test: makeResult-no-spec ===

    public function test_make_result_no_spec(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = null;
        $ctx->result = new ZefoyTiktokBotResult([
            'ok' => true,
            'status' => 200,
            'statusText' => 'OK',
            'headers' => [],
        ]);

        [$_, $err] = ($utility->make_result)($ctx);
        $this->assertNotNull($err, 'expected error for null spec');
    }


    // === Test: makeResult-no-result ===

    public function test_make_result_no_result(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->spec = new ZefoyTiktokBotSpec(['step' => 'start']);
        $ctx->result = null;

        [$_, $err] = ($utility->make_result)($ctx);
        $this->assertNotNull($err, 'expected error for null result');
    }


    // === Test: makeSpec-basic ===

    public function test_make_spec_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $setup_opts = self::get_spec($primary, 'makeSpec', 'DEF', 'setup', 'a');
        $spec_client = ZefoyTiktokBotSDK::test(null, $setup_opts);
        $spec_utility = $spec_client->get_utility();
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeSpec', 'basic'), function (array &$entry) use ($spec_client, $spec_utility, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $spec_client, $spec_utility);
            $ctx->options = $spec_client->options_map();

            [$_, $err] = ($utility->make_spec)($ctx);

            // Update entry ctx for match
            if ($ctx->spec !== null) {
                $entry['ctx']['spec'] = [
                    'base' => $ctx->spec->base,
                    'prefix' => $ctx->spec->prefix,
                    'suffix' => $ctx->spec->suffix,
                    'method' => $ctx->spec->method,
                    'params' => $ctx->spec->params,
                    'query' => $ctx->spec->query,
                    'headers' => $ctx->spec->headers,
                    'step' => $ctx->spec->step,
                ];
            }

            return [null, $err];
        });
    }


    // === Test: makePoint-basic ===

    public function test_make_point_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_ctx($client, $utility);
        $point = [
            'parts' => ['items', '{id}'],
            'args' => ['params' => []],
            'params' => [],
            'alias' => [],
            'select' => [],
            'active' => true,
            'transform' => [],
        ];
        $ctx->op->points = [$point];

        [$_, $err] = ($utility->make_point)($ctx);
        $this->assertNull($err, 'expected no error');
        $this->assertNotNull($ctx->point, 'expected point to be set');
    }


    // === Test: makeUrl-basic ===

    public function test_make_url_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'makeUrl', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            if ($ctx->result === null) {
                $ctx->result = new ZefoyTiktokBotResult([]);
            }
            return ($utility->make_url)($ctx);
        });
    }


    // === Test: operator-basic ===

    public function test_operator_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');

        $this->runset(self::get_spec($primary, 'operator', 'basic'), function (array $entry) {
            $in = $entry['in'] ?? [];
            $op = new ZefoyTiktokBotOperation($in);
            return [[
                'entity' => $op->entity,
                'name' => $op->name,
                'input' => $op->input,
                'points' => $op->points,
            ], null];
        });
    }


    // === Test: param-basic ===

    public function test_param_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'param', 'basic'), function (array &$entry) use ($client, $utility) {
            $args = $entry['args'] ?? [];
            if (count($args) < 2) {
                return [null, null];
            }

            $ctxmap = $args[0] ?? [];
            if (!is_array($ctxmap)) {
                $ctxmap = [];
            }
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            $paramdef = $args[1];

            $result = ($utility->param)($ctx, $paramdef);

            // Update entry ctx for match
            if (isset($entry['match']) && is_array($entry['match'])) {
                if (isset($entry['match']['ctx']) && is_array($entry['match']['ctx'])) {
                    $ctx_match = $entry['match']['ctx'];
                    if (!isset($entry['ctx'])) {
                        $entry['ctx'] = [];
                    }
                    if (isset($ctx_match['spec']) && is_array($ctx_match['spec'])) {
                        if ($ctx->spec !== null) {
                            if (isset($ctx_match['spec']['alias'])) {
                                $entry['ctx']['spec'] = [
                                    'alias' => $ctx->spec->alias_map,
                                ];
                            }
                        }
                    }
                }
            }

            return [$result, null];
        });
    }


    // === Test: prepareAuth-basic ===

    public function test_prepare_auth_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $setup_opts = self::get_spec($primary, 'prepareAuth', 'DEF', 'setup', 'a');
        $auth_client = ZefoyTiktokBotSDK::test(null, $setup_opts);
        $auth_utility = $auth_client->get_utility();
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareAuth', 'basic'), function (array &$entry) use ($auth_client, $auth_utility, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $auth_client, $auth_utility);
            self::fixctx($ctx, $auth_client);

            [$_, $err] = ($utility->prepare_auth)($ctx);

            // Update entry ctx for match
            if ($ctx->spec !== null) {
                $entry['ctx']['spec'] = [
                    'headers' => $ctx->spec->headers,
                ];
            }

            return [null, $err];
        });
    }


    // === Test: prepareBody-basic ===

    public function test_prepare_body_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareBody', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            self::fixctx($ctx, $client);
            return [($utility->prepare_body)($ctx), null];
        });
    }


    // === Test: prepareHeaders-basic ===

    public function test_prepare_headers_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareHeaders', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            return [($utility->prepare_headers)($ctx), null];
        });
    }


    // === Test: prepareMethod-basic ===

    public function test_prepare_method_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareMethod', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            return [($utility->prepare_method)($ctx), null];
        });
    }


    // === Test: prepareParams-basic ===

    public function test_prepare_params_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareParams', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            return [($utility->prepare_params)($ctx), null];
        });
    }


    // === Test: preparePath-basic ===

    public function test_prepare_path_basic(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->point = [
            'parts' => ['api', 'planet', '{id}'],
            'args' => ['params' => []],
        ];

        $path = ($utility->prepare_path)($ctx);
        $this->assertEquals('api/planet/{id}', $path);
    }


    // === Test: preparePath-single ===

    public function test_prepare_path_single(): void
    {
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();
        $ctx = self::make_test_full_ctx($client, $utility);
        $ctx->point = [
            'parts' => ['items'],
            'args' => ['params' => []],
        ];

        $path = ($utility->prepare_path)($ctx);
        $this->assertEquals('items', $path);
    }


    // === Test: prepareQuery-basic ===

    public function test_prepare_query_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'prepareQuery', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            return [($utility->prepare_query)($ctx), null];
        });
    }


    // === Test: resultBasic-basic ===

    public function test_result_basic_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'resultBasic', 'basic'), function (array $entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);
            self::fixctx($ctx, $client);

            $result = ($utility->result_basic)($ctx);

            $out = [
                'status' => $result->status,
                'statusText' => $result->status_text,
            ];
            if ($result->err !== null) {
                $err_msg = ($result->err instanceof ZefoyTiktokBotError) ? $result->err->msg : (string)$result->err;
                $out['err'] = ['message' => $err_msg];
            }

            return [$out, null];
        });
    }


    // === Test: resultBody-basic ===

    public function test_result_body_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'resultBody', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);

            ($utility->result_body)($ctx);

            // Update entry ctx for match
            if ($ctx->result !== null) {
                $entry['ctx']['result'] = [
                    'body' => $ctx->result->body,
                ];
            }

            return [null, null];
        });
    }


    // === Test: resultHeaders-basic ===

    public function test_result_headers_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'resultHeaders', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);

            ($utility->result_headers)($ctx);

            // Update entry ctx for match
            if ($ctx->result !== null) {
                $entry['ctx']['result'] = [
                    'headers' => $ctx->result->headers,
                ];
            }

            return [null, null];
        });
    }


    // === Test: transformRequest-basic ===

    public function test_transform_request_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'transformRequest', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);

            $result = ($utility->transform_request)($ctx);

            // Update entry ctx for match (step changed)
            if ($ctx->spec !== null && isset($entry['ctx']['spec']) && is_array($entry['ctx']['spec'])) {
                $entry['ctx']['spec']['step'] = $ctx->spec->step;
            }

            return [$result, null];
        });
    }


    // === Test: transformResponse-basic ===

    public function test_transform_response_basic(): void
    {
        $spec = self::load_test_spec();
        $primary = self::get_spec($spec, 'primary');
        $client = ZefoyTiktokBotSDK::test(null, null);
        $utility = $client->get_utility();

        $this->runset(self::get_spec($primary, 'transformResponse', 'basic'), function (array &$entry) use ($client, $utility) {
            $ctxmap = $entry['ctx'] ?? [];
            $ctx = self::make_ctx_from_map($ctxmap, $client, $utility);

            $result = ($utility->transform_response)($ctx);

            // Update entry ctx for match (step changed)
            if ($ctx->spec !== null && isset($entry['ctx']['spec']) && is_array($entry['ctx']['spec'])) {
                $entry['ctx']['spec']['step'] = $ctx->spec->step;
            }

            return [$result, null];
        });
    }
}
