<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK netsim feature

require_once __DIR__ . '/BaseFeature.php';

// Network behaviour simulation. Wraps the active transport (the live
// fetcher or the `test` feature's in-memory mock) and injects realistic
// network conditions so offline unit tests can exercise slowness,
// transient failures, rate limiting and outages deterministically.
//
// Every injection mode is counter-driven (per client instance) so tests
// are reproducible without mocking timers. `failRate` adds optional
// pseudo-random failures via a seeded LCG for coverage-style testing.
// Mirrors ts/src/feature/netsim/NetsimFeature.ts.
class ZefoyTiktokBotNetsimFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private int $calls;
    private int $seed;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'netsim';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->calls = 0;
        $this->seed = 1;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $seed = is_numeric($options['seed'] ?? null) ? (int)$options['seed'] : 0;
        $this->seed = $seed !== 0 ? $seed : 1;

        if (!$this->active) {
            return;
        }

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ZefoyTiktokBotContext $ctx2, string $url, array $fetchdef) use ($inner): array {
            return $this->_simulate($ctx2, $url, $fetchdef, $inner);
        };
    }

    private function _simulate(ZefoyTiktokBotContext $ctx, string $url, array $fetchdef, callable $inner): array
    {
        $opts = $this->options ?? [];
        $this->calls++;
        $call = $this->calls;

        // Record the simulated conditions for test/debug inspection.
        $applied = [];

        // Total outage: every call fails at the transport level.
        if (($opts['offline'] ?? null) === true) {
            $this->_sleep($this->_pick_latency());
            $applied['offline'] = true;
            $this->_track($ctx, $applied);
            return [null, $ctx->make_error('netsim_offline',
                "Simulated network offline (URL was: \"{$url}\")")];
        }

        // Connection-level errors for the first N calls (e.g. ECONNRESET).
        if ($call <= (int)($opts['errorTimes'] ?? 0)) {
            $this->_sleep($this->_pick_latency());
            $applied['error'] = true;
            $this->_track($ctx, $applied);
            return [null, $ctx->make_error('netsim_conn',
                "Simulated connection error (call {$call})")];
        }

        // Rate-limit responses (HTTP 429 + Retry-After) for the first N calls.
        if ($call <= (int)($opts['rateLimitTimes'] ?? 0)) {
            $this->_sleep($this->_pick_latency());
            $applied['rateLimited'] = true;
            $this->_track($ctx, $applied);
            $retry_after = $opts['retryAfter'] ?? 0;
            return $this->_respond(429, null, [
                'statusText' => 'Too Many Requests',
                'headers' => ['retry-after' => (string)(is_numeric($retry_after) ? $retry_after : 0)],
            ]);
        }

        // Retryable failure status for the first N calls, or every Nth call,
        // or (seeded) randomly at `failRate`.
        $fail_status = is_numeric($opts['failStatus'] ?? null) ? (int)$opts['failStatus'] : 503;
        $fail_by_count = $call <= (int)($opts['failTimes'] ?? 0);
        $fail_every = (int)($opts['failEvery'] ?? 0);
        $fail_by_every = $fail_every > 0 && $call % $fail_every === 0;
        $fail_rate = is_numeric($opts['failRate'] ?? null) ? (float)$opts['failRate'] : 0.0;
        $fail_by_rate = $fail_rate > 0 && $this->_rand() < $fail_rate;
        if ($fail_by_count || $fail_by_every || $fail_by_rate) {
            $this->_sleep($this->_pick_latency());
            $applied['failStatus'] = $fail_status;
            $this->_track($ctx, $applied);
            return $this->_respond($fail_status, null, ['statusText' => 'Simulated Failure']);
        }

        // Otherwise: apply latency then delegate to the real transport.
        $latency = $this->_pick_latency();
        $applied['latency'] = $latency;
        $this->_track($ctx, $applied);
        $this->_sleep($latency);
        return $inner($ctx, $url, $fetchdef);
    }

    // Latency in ms: a fixed number, or a uniform sample from {min,max}.
    private function _pick_latency(): float
    {
        $l = $this->options['latency'] ?? null;
        if ($l === null) {
            return 0.0;
        }
        if (is_numeric($l)) {
            return $l < 0 ? 0.0 : (float)$l;
        }
        if (!is_array($l)) {
            return 0.0;
        }
        $min = (int)($l['min'] ?? 0);
        $max = isset($l['max']) && is_numeric($l['max']) ? (int)$l['max'] : $min;
        if ($max <= $min) {
            return (float)$min;
        }
        return (float)($min + (int)floor($this->_rand() * ($max - $min)));
    }

    private function _sleep(mixed $ms): void
    {
        if (!is_numeric($ms) || $ms <= 0) {
            return;
        }
        $sleep = $this->options['sleep'] ?? null;
        if (is_callable($sleep)) {
            $sleep($ms);
            return;
        }
        usleep((int)($ms * 1000));
    }

    // Deterministic 0..1 pseudo-random via a linear congruential generator.
    private function _rand(): float
    {
        $this->seed = ($this->seed * 1103515245 + 12345) & 0x7fffffff;
        return $this->seed / 0x7fffffff;
    }

    private function _track(ZefoyTiktokBotContext $ctx, array $applied): void
    {
        $client = $this->client;
        if (!isset($client->_netsim)) {
            $client->_netsim = ['calls' => 0, 'applied' => []];
        }
        $client->_netsim['calls']++;
        $client->_netsim['applied'][] = $applied;
        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['netsim'] = $client->_netsim;
        }
    }

    // Build a transport-shaped response (matching the test feature's mock)
    // as a `[response, err]` tuple the request pipeline understands.
    private function _respond(int $status, mixed $data = null, ?array $extra = null): array
    {
        $out = [
            'status' => $status,
            'statusText' => 'OK',
            'json' => function () use ($data) { return $data; },
            'body' => 'not-used',
            'headers' => [],
        ];
        if (is_array($extra)) {
            foreach ($extra as $k => $v) {
                $out[$k] = $v;
            }
        }
        return [$out, null];
    }
}
