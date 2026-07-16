<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK timeout feature

require_once __DIR__ . '/BaseFeature.php';

// Per-request timeout. Wraps the active transport with a deadline of `ms`
// milliseconds (default 30000; <= 0 disables). PHP transports are
// synchronous, so an in-flight request cannot be raced/aborted the way the
// TS implementation cancels a fetch via AbortController. Instead the
// deadline is enforced two ways: the fetch definition is annotated with a
// `timeout` (ms) hint that transport implementations can honour (e.g. cURL
// CURLOPT_TIMEOUT), and the wall clock is checked after the inner call —
// when the deadline has passed the call resolves to a `timeout` error even
// if the transport eventually returned. Mirrors
// ts/src/feature/timeout/TimeoutFeature.ts within those limits.
class ZefoyTiktokBotTimeoutFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'timeout';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        if (!$this->active) {
            return;
        }

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ZefoyTiktokBotContext $ctx2, string $url, array $fetchdef) use ($inner): array {
            return $this->_with_timeout($ctx2, $url, $fetchdef, $inner);
        };
    }

    private function _with_timeout(ZefoyTiktokBotContext $ctx, string $url, array $fetchdef, callable $inner): array
    {
        $ms = is_numeric($this->options['ms'] ?? null) ? (float)$this->options['ms'] : 30000.0;
        if ($ms <= 0) {
            return $inner($ctx, $url, $fetchdef);
        }

        // Annotate the fetch definition so a transport-level timeout can be
        // applied by the actual HTTP client (the synchronous analogue of
        // attaching an abort signal).
        if (!isset($fetchdef['timeout'])) {
            $fetchdef['timeout'] = $ms;
        }

        $start = $this->_now();
        [$res, $err] = $inner($ctx, $url, $fetchdef);
        $elapsed = $this->_now() - $start;

        if ($elapsed > $ms) {
            $this->_track($ctx, $ms);
            return [null, $ctx->make_error('timeout',
                "Request exceeded timeout of {$ms}ms")];
        }

        return [$res, $err];
    }

    private function _now(): float
    {
        $now = $this->options['now'] ?? null;
        if (is_callable($now)) {
            return (float)$now();
        }
        return microtime(true) * 1000.0;
    }

    private function _track(ZefoyTiktokBotContext $_ctx, float $ms): void
    {
        $client = $this->client;
        if (!isset($client->_timeout)) {
            $client->_timeout = ['count' => 0, 'ms' => $ms];
        }
        $client->_timeout['count']++;
    }
}
