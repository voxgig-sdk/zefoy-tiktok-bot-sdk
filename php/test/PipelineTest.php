<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK pipeline test
//
// Direct unit tests for the operation-pipeline utilities. The generated
// entity tests exercise the happy path; these drive the error and edge
// branches (missing spec/response/result, 4xx handling, transport
// failures, feature ordering, auth header shaping) that a normal
// success-path op never reaches. Mirrors tm/ts/test/pipeline.test.ts,
// adapted to the PHP utility APIs (tuple `[value, err]` returns instead of
// returned Error values).
//
// Inapplicable TS cases (noted rather than ported):
// - "a body-parse exception is captured on result.err": the PHP
//   result_body utility calls the response json closure without a guard,
//   so a throwing body surfaces as an exception, not on result->err.
// - makeFetchDef "inits a missing result": covered, but note the PHP
//   make_fetch_def builds the URL through make_url (spec parts/path), not
//   inline.

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';
require_once __DIR__ . '/Runner.php';

use PHPUnit\Framework\TestCase;

// Fake client exposing exactly the options map a test wants.
class PlClient
{
    public string $mode = 'test';
    public array $features = [];
    public array $options;

    public function __construct(array $options = [])
    {
        $this->options = $options;
    }

    public function options_map(): array
    {
        return $this->options;
    }
}

// Fake entity for the make_result list wrap: make() yields an item that
// records the data it was given.
class PlEntityItem
{
    public array $data = [];

    public function data_set(array $d): void
    {
        $this->data = $d;
    }
}

class PlEntity
{
    public array $made = [];

    public function get_name(): string
    {
        return 'x';
    }

    public function make(): PlEntityItem
    {
        $item = new PlEntityItem();
        $this->made[] = $item;
        return $item;
    }
}

class PipelineTest extends TestCase
{
    private static function utility(): ZefoyTiktokBotUtility
    {
        return new ZefoyTiktokBotUtility();
    }

    // Transport-shaped response array with a re-readable body.
    private static function resp(int $status, mixed $data = null, array $headers = []): array
    {
        $h = [];
        foreach ($headers as $k => $v) {
            $h[strtolower((string)$k)] = $v;
        }
        return [
            'status' => $status,
            'statusText' => $status < 400 ? 'OK' : 'ERR',
            'body' => 'body',
            'json' => function () use ($data) { return $data; },
            'headers' => $h,
        ];
    }

    private static function ctx(array $over = []): ZefoyTiktokBotContext
    {
        $utility = $over['utility'] ?? self::utility();
        $client = $over['client'] ?? new PlClient(['base' => 'http://h']);
        $ctx = new ZefoyTiktokBotContext([
            'client' => $client,
            'utility' => $utility,
        ], null);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'load', 'entity' => 'x']);
        foreach ($over as $k => $v) {
            if ($k === 'utility' || $k === 'client') {
                continue;
            }
            $ctx->$k = $v;
        }
        return $ctx;
    }

    private static function code(mixed $err): string
    {
        return ($err instanceof ZefoyTiktokBotError) ? $err->sdk_code : '';
    }


    // --- feature order (feature #2) -----------------------------------------
    // options['feature'] accepts an ordered LIST (developer add-order) or a map
    // (defaults test-first); make_options records the resolved order in
    // __derived__.featureorder.

    private static function resolve_order(mixed $feature): string
    {
        $utility = self::utility();
        $client = new PlClient([]);
        $ctx = new ZefoyTiktokBotContext([
            'client' => $client,
            'utility' => $utility,
        ], null);
        $ctx->options = ['feature' => $feature];
        $ctx->config = ['options' => []];
        $opts = ($utility->make_options)($ctx);
        $order = $opts['__derived__']['featureorder'] ?? [];
        return implode(',', $order);
    }

    public function test_feature_order_map_is_test_first(): void
    {
        $this->assertSame('test,metrics', self::resolve_order([
            'metrics' => ['active' => true],
            'test' => ['active' => true],
        ]));
    }

    public function test_feature_order_list_preserves_order(): void
    {
        $this->assertSame('metrics,test', self::resolve_order([
            ['name' => 'metrics', 'active' => true],
            ['name' => 'test', 'active' => true],
        ]));
    }

    public function test_feature_order_no_test_deterministic(): void
    {
        $this->assertSame('cache,retry', self::resolve_order([
            'retry' => ['active' => true],
            'cache' => ['active' => true],
        ]));
    }


    // --- make_point + make_spec ---------------------------------------------

    public function test_make_point_rejects_a_disallowed_operation(): void
    {
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load']]]);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'nope', 'entity' => 'x']);
        [$point, $err] = ZefoyTiktokBotMakePoint::call($ctx);
        $this->assertNull($point);
        $this->assertSame('point_op_allow', self::code($err));
    }

    public function test_make_point_rejects_an_operation_with_no_endpoints(): void
    {
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load,list,create,update,remove']]]);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'load', 'entity' => 'x', 'points' => []]);
        [$point, $err] = ZefoyTiktokBotMakePoint::call($ctx);
        $this->assertNull($point);
        $this->assertSame('point_no_points', self::code($err));
    }

    public function test_make_point_returns_the_single_point(): void
    {
        $point = ['method' => 'GET', 'parts' => ['a']];
        $ctx = self::ctx(['options' => ['allow' => ['op' => 'load,list,create,update,remove']]]);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'load', 'entity' => 'x', 'points' => [$point]]);
        [$got, $err] = ZefoyTiktokBotMakePoint::call($ctx);
        $this->assertNull($err);
        $this->assertSame($point, $got);
    }

    public function test_make_point_short_circuits_a_feature_supplied_point(): void
    {
        $preset = ['method' => 'GET'];
        $ctx = self::ctx();
        $ctx->out['point'] = $preset;
        [$got, $err] = ZefoyTiktokBotMakePoint::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }

    public function test_make_point_surfaces_a_feature_supplied_error(): void
    {
        // The rbac feature places its denial in ctx.out.point (PrePoint);
        // make_point must surface it as the pipeline error before any
        // endpoint resolution or network activity.
        $ctx = self::ctx();
        $denial = $ctx->make_error('rbac_denied', 'Permission "admin" required for operation "load"');
        $ctx->out['point'] = $denial;
        [$got, $err] = ZefoyTiktokBotMakePoint::call($ctx);
        $this->assertNull($got);
        $this->assertSame($denial, $err);
        $this->assertSame('rbac_denied', self::code($err));
    }

    public function test_make_spec_short_circuits_a_feature_supplied_spec(): void
    {
        $preset = new ZefoyTiktokBotSpec(['method' => 'GET']);
        $ctx = self::ctx();
        $ctx->out['spec'] = $preset;
        [$got, $err] = ZefoyTiktokBotMakeSpec::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_response ---------------------------------------------------------

    public function test_make_response_guards_missing_spec_response_result(): void
    {
        $ctx = self::ctx([
            'spec' => null,
            'response' => new ZefoyTiktokBotResponse([]),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        [, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertSame('response_no_spec', self::code($err));

        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec([]),
            'response' => null,
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        [, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertSame('response_no_response', self::code($err));

        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec([]),
            'response' => new ZefoyTiktokBotResponse([]),
            'result' => null,
        ]);
        [, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertSame('response_no_result', self::code($err));
    }

    public function test_make_response_4xx_sets_result_err_and_copies_headers(): void
    {
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec(['step' => 's']),
            'response' => new ZefoyTiktokBotResponse(self::resp(404, null, ['x-a' => '1'])),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        [, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($ctx->result->err);
        $this->assertSame(404, $ctx->result->status);
        $this->assertSame('1', $ctx->result->headers['x-a']);
        $this->assertFalse($ctx->result->ok);
    }

    public function test_make_response_2xx_parses_the_body_and_marks_ok(): void
    {
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec(['step' => 's']),
            'response' => new ZefoyTiktokBotResponse(self::resp(200, ['v' => 1])),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        [, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertTrue($ctx->result->ok);
        $this->assertSame(['v' => 1], $ctx->result->body);
    }

    public function test_make_response_records_to_ctrl_explain_when_explain_is_on(): void
    {
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec(['step' => 's']),
            'response' => new ZefoyTiktokBotResponse(self::resp(200, ['v' => 2])),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        $ctx->ctrl->explain = ['on' => true];
        ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertNotNull($ctx->ctrl->explain['result'] ?? null);
    }

    public function test_make_response_short_circuits_a_feature_supplied_response(): void
    {
        $preset = new ZefoyTiktokBotResponse(self::resp(299));
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec([]),
            'response' => new ZefoyTiktokBotResponse([]),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        $ctx->out['response'] = $preset;
        [$got, $err] = ZefoyTiktokBotMakeResponse::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_result -----------------------------------------------------------

    public function test_make_result_guards_missing_spec_and_result(): void
    {
        $ctx = self::ctx(['spec' => null, 'result' => new ZefoyTiktokBotResult([])]);
        [, $err] = ZefoyTiktokBotMakeResult::call($ctx);
        $this->assertSame('result_no_spec', self::code($err));

        $ctx = self::ctx(['spec' => new ZefoyTiktokBotSpec([]), 'result' => null]);
        [, $err] = ZefoyTiktokBotMakeResult::call($ctx);
        $this->assertSame('result_no_result', self::code($err));
    }

    public function test_make_result_list_op_wraps_resdata_into_entity_instances(): void
    {
        $entity = new PlEntity();
        $ctx = self::ctx([
            'entity' => $entity,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's']),
            'result' => new ZefoyTiktokBotResult(['ok' => true, 'resdata' => [['a' => 1], ['a' => 2]]]),
        ]);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'list', 'entity' => 'x']);
        [$result, $err] = ZefoyTiktokBotMakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertCount(2, $result->resdata);
        $this->assertCount(2, $entity->made);
        $this->assertSame(['a' => 1], $result->resdata[0]->data);
    }

    public function test_make_result_empty_list_yields_empty_resdata(): void
    {
        $entity = new PlEntity();
        $ctx = self::ctx([
            'entity' => $entity,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's']),
            'result' => new ZefoyTiktokBotResult(['ok' => true, 'resdata' => []]),
        ]);
        $ctx->op = new ZefoyTiktokBotOperation(['name' => 'list', 'entity' => 'x']);
        [$result, $err] = ZefoyTiktokBotMakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertSame([], $result->resdata);
        $this->assertCount(0, $entity->made);
    }

    public function test_make_result_short_circuits_on_a_preset_result(): void
    {
        $preset = new ZefoyTiktokBotResult(['ok' => true]);
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec([]),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        $ctx->out['result'] = $preset;
        [$got, $err] = ZefoyTiktokBotMakeResult::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }


    // --- make_request -----------------------------------------------------------

    public function test_make_request_guards_a_missing_spec(): void
    {
        $ctx = self::ctx(['spec' => null]);
        [, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertSame('request_no_spec', self::code($err));
    }

    public function test_make_request_a_transport_error_is_carried_on_the_response(): void
    {
        $utility = self::utility();
        $boom = new ZefoyTiktokBotError('boom', 'boom');
        $utility->fetcher = function (ZefoyTiktokBotContext $_c, string $_u, array $_f) use ($boom): array {
            return [null, $boom];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertSame($boom, $response->err);
    }

    public function test_make_request_a_null_transport_result_becomes_a_response_error(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (ZefoyTiktokBotContext $_c, string $_u, array $_f): array {
            return [null, null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($response->err);
        $this->assertSame('request_no_response', self::code($response->err));
    }

    public function test_make_request_a_normal_transport_response_is_wrapped(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (ZefoyTiktokBotContext $_c, string $_u, array $_f): array {
            return [PipelineTest::resp_public(200, ['a' => 1]), null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        [$response, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertInstanceOf(ZefoyTiktokBotResponse::class, $response);
        $this->assertSame(200, $response->status);
    }

    public function test_make_request_records_the_fetchdef_to_ctrl_explain(): void
    {
        $utility = self::utility();
        $utility->fetcher = function (ZefoyTiktokBotContext $_c, string $_u, array $_f): array {
            return [PipelineTest::resp_public(200, []), null];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's', 'method' => 'GET', 'base' => 'http://h', 'parts' => ['a']]),
        ]);
        $ctx->ctrl->explain = ['on' => true];
        ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNotNull($ctx->ctrl->explain['fetchdef'] ?? null);
    }

    public function test_make_request_a_fetchdef_error_surfaces_as_a_response_error(): void
    {
        $utility = self::utility();
        $utility->make_fetch_def = function (ZefoyTiktokBotContext $c): array {
            return [null, $c->make_error('fetchdef_boom', 'boom')];
        };
        $ctx = self::ctx([
            'utility' => $utility,
            'spec' => new ZefoyTiktokBotSpec(['step' => 's', 'method' => 'GET']),
        ]);
        [$response, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertNotNull($response->err);
        $this->assertSame('fetchdef_boom', self::code($response->err));
        $this->assertSame('postrequest', $ctx->spec->step);
    }

    public function test_make_request_short_circuits_a_feature_supplied_request(): void
    {
        $preset = new ZefoyTiktokBotResponse(self::resp(201));
        $ctx = self::ctx(['spec' => new ZefoyTiktokBotSpec([])]);
        $ctx->out['request'] = $preset;
        [$got, $err] = ZefoyTiktokBotMakeRequest::call($ctx);
        $this->assertNull($err);
        $this->assertSame($preset, $got);
    }

    // Public wrapper so closures above can build responses.
    public static function resp_public(int $status, mixed $data = null, array $headers = []): array
    {
        return self::resp($status, $data, $headers);
    }


    // --- make_fetch_def ----------------------------------------------------------

    public function test_make_fetch_def_guards_a_missing_spec(): void
    {
        $ctx = self::ctx(['spec' => null]);
        [, $err] = ZefoyTiktokBotMakeFetchDef::call($ctx);
        $this->assertSame('fetchdef_no_spec', self::code($err));
    }

    public function test_make_fetch_def_serialises_body_and_inits_missing_result(): void
    {
        $ctx = self::ctx([
            'spec' => new ZefoyTiktokBotSpec([
                'step' => 's', 'method' => 'POST', 'base' => 'http://h',
                'prefix' => '', 'suffix' => '', 'path' => 'a', 'body' => ['x' => 1],
            ]),
            'result' => null,
        ]);
        [$fetchdef, $err] = ZefoyTiktokBotMakeFetchDef::call($ctx);
        $this->assertNull($err);
        $this->assertIsString($fetchdef['body']);
        $this->assertStringContainsString('http://h', $fetchdef['url']);
        $this->assertNotNull($ctx->result); // result was lazily created
    }


    // --- make_error + done ---------------------------------------------------------

    public function test_done_returns_resdata_on_success(): void
    {
        $ctx = self::ctx(['result' => new ZefoyTiktokBotResult(['ok' => true, 'resdata' => 42])]);
        $this->assertSame(42, ZefoyTiktokBotDone::call($ctx));
    }

    public function test_done_raises_the_error_when_not_ok(): void
    {
        $ctx = self::ctx(['result' => new ZefoyTiktokBotResult(['ok' => false])]);
        $this->expectException(ZefoyTiktokBotError::class);
        ZefoyTiktokBotDone::call($ctx);
    }

    public function test_make_error_returns_resdata_when_ctrl_throw_is_false(): void
    {
        $ctx = self::ctx(['result' => new ZefoyTiktokBotResult(['ok' => false, 'resdata' => 'fallback'])]);
        $ctx->ctrl->throw_err = false;
        $this->assertSame('fallback', ZefoyTiktokBotMakeError::call($ctx, null));
    }

    public function test_make_error_records_to_ctrl_explain(): void
    {
        $ctx = self::ctx(['result' => new ZefoyTiktokBotResult(['ok' => false])]);
        $ctx->ctrl->throw_err = false;
        $ctx->ctrl->explain = ['on' => true];
        ZefoyTiktokBotMakeError::call($ctx, null);
        $this->assertNotNull($ctx->ctrl->explain['err'] ?? null);
    }


    // --- feature_add ordering ---------------------------------------------------

    public function test_feature_add_appends_in_call_order(): void
    {
        $client = new PlClient([]);
        $ctx = self::ctx(['client' => $client]);
        $a = new ZefoyTiktokBotBaseFeature();
        $b = new ZefoyTiktokBotBaseFeature();
        ZefoyTiktokBotFeatureAdd::call($ctx, $a);
        ZefoyTiktokBotFeatureAdd::call($ctx, $b);
        $this->assertSame([$a, $b], $client->features);
    }

    private static function named_feature(string $name): ZefoyTiktokBotBaseFeature
    {
        $f = new ZefoyTiktokBotBaseFeature();
        $f->name = $name;
        return $f;
    }

    public function test_feature_add_ordering_before_after_replace(): void
    {
        // `_options` on an extend-feature instance positions it relative to
        // an already-added feature (mirrors the TS featureAdd).
        $client = new PlClient([]);
        $ctx = self::ctx(['client' => $client]);
        $names = fn() => array_map(fn($f) => $f->name, $client->features);

        ZefoyTiktokBotFeatureAdd::call($ctx, self::named_feature('a'));
        ZefoyTiktokBotFeatureAdd::call($ctx, self::named_feature('b'));
        $this->assertSame(['a', 'b'], $names());

        $before = self::named_feature('z1');
        $before->_options = ['__before__' => 'b'];
        ZefoyTiktokBotFeatureAdd::call($ctx, $before);
        $this->assertSame(['a', 'z1', 'b'], $names());

        $after = self::named_feature('z2');
        $after->_options = ['__after__' => 'a'];
        ZefoyTiktokBotFeatureAdd::call($ctx, $after);
        $this->assertSame(['a', 'z2', 'z1', 'b'], $names());

        $replace = self::named_feature('z3');
        $replace->_options = ['__replace__' => 'z1'];
        ZefoyTiktokBotFeatureAdd::call($ctx, $replace);
        $this->assertSame(['a', 'z2', 'z3', 'b'], $names());

        // An ordering option naming no existing feature falls back to append.
        $miss = self::named_feature('z4');
        $miss->_options = ['__before__' => 'missing'];
        ZefoyTiktokBotFeatureAdd::call($ctx, $miss);
        $this->assertSame(['a', 'z2', 'z3', 'b', 'z4'], $names());
    }


    // --- prepare_auth ------------------------------------------------------------

    private static function auth_ctx(array $options, ?array $headers): ZefoyTiktokBotContext
    {
        $client = new PlClient($options);
        return self::ctx([
            'client' => $client,
            'spec' => $headers === null ? null : new ZefoyTiktokBotSpec(['headers' => $headers]),
        ]);
    }

    public function test_prepare_auth_guards_a_missing_spec(): void
    {
        $ctx = self::auth_ctx(['auth' => ['prefix' => ''], 'apikey' => 'K'], null);
        [, $err] = ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertSame('auth_no_spec', self::code($err));
    }

    public function test_prepare_auth_an_apikey_with_a_prefix_is_space_joined(): void
    {
        $ctx = self::auth_ctx(['apikey' => 'K', 'auth' => ['prefix' => 'Bearer']], []);
        [, $err] = ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertNull($err);
        $this->assertSame('Bearer K', $ctx->spec->headers['authorization']);
    }

    public function test_prepare_auth_a_raw_apikey_goes_in_as_is(): void
    {
        $ctx = self::auth_ctx(['apikey' => 'K', 'auth' => ['prefix' => '']], []);
        ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertSame('K', $ctx->spec->headers['authorization']);
    }

    public function test_prepare_auth_an_empty_apikey_drops_the_header(): void
    {
        $ctx = self::auth_ctx(
            ['apikey' => '', 'auth' => ['prefix' => 'Bearer']],
            ['authorization' => 'stale']
        );
        ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertArrayNotHasKey('authorization', $ctx->spec->headers);
    }

    public function test_prepare_auth_a_public_api_drops_the_header(): void
    {
        $ctx = self::auth_ctx(['apikey' => 'K'], ['authorization' => 'stale']);
        ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertArrayNotHasKey('authorization', $ctx->spec->headers);
    }

    public function test_prepare_auth_a_missing_apikey_option_drops_the_header(): void
    {
        $ctx = self::auth_ctx(['auth' => ['prefix' => 'Bearer']], ['authorization' => 'stale']);
        ZefoyTiktokBotPrepareAuth::call($ctx);
        $this->assertArrayNotHasKey('authorization', $ctx->spec->headers);
    }


    // --- result helpers ------------------------------------------------------------

    public function test_result_headers_with_non_array_headers_yields_empty_map(): void
    {
        $ctx = self::ctx([
            'response' => new ZefoyTiktokBotResponse(['headers' => null]),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        ZefoyTiktokBotResultHeaders::call($ctx);
        $this->assertSame([], $ctx->result->headers);
    }

    public function test_result_body_skips_parsing_when_the_body_is_absent(): void
    {
        $ctx = self::ctx([
            'response' => new ZefoyTiktokBotResponse([
                'json' => function () { return ['a' => 1]; },
                'body' => null,
            ]),
            'result' => new ZefoyTiktokBotResult([]),
        ]);
        ZefoyTiktokBotResultBody::call($ctx);
        $this->assertNull($ctx->result->body);
    }
}
