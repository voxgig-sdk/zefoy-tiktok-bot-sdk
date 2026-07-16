<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK ratelimit feature

require_once __DIR__ . '/BaseFeature.php';

// Client-side rate limiting via a token bucket. Each request consumes a
// token; when the bucket is empty the request waits until the bucket
// refills at `rate` tokens per second (with capacity `burst`, default:
// `rate`). This keeps the client under a server's published quota rather
// than discovering it via 429s. The clock (`now`) and the wait (`sleep`)
// are injectable so the accounting can be tested deterministically without
// wall-clock timing. Mirrors ts/src/feature/ratelimit/RatelimitFeature.ts.
class ZefoyTiktokBotRatelimitFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private float $tokens;
    private float $last;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'ratelimit';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->tokens = 0.0;
        $this->last = 0.0;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        if (!$this->active) {
            return;
        }

        $rate = is_numeric($options['rate'] ?? null) && (float)$options['rate'] > 0
            ? (float)$options['rate'] : 5.0;
        $burst = is_numeric($options['burst'] ?? null) ? (float)$options['burst'] : $rate;
        $this->tokens = $burst;
        $this->last = $this->_now();

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ZefoyTiktokBotContext $ctx2, string $url, array $fetchdef) use ($inner): array {
            $this->_acquire($ctx2);
            return $inner($ctx2, $url, $fetchdef);
        };
    }

    private function _acquire(ZefoyTiktokBotContext $ctx): void
    {
        $rate = is_numeric($this->options['rate'] ?? null) && (float)$this->options['rate'] > 0
            ? (float)$this->options['rate'] : 5.0;
        $burst = is_numeric($this->options['burst'] ?? null) ? (float)$this->options['burst'] : $rate;

        // Refill according to elapsed time.
        $now = $this->_now();
        $elapsed = $now - $this->last;
        $this->last = $now;
        $this->tokens = min($burst, $this->tokens + ($elapsed / 1000.0) * $rate);

        if ($this->tokens >= 1) {
            $this->tokens -= 1;
            return;
        }

        // Not enough tokens: wait for one to accrue, then consume it.
        $needed = 1 - $this->tokens;
        $wait_ms = (float)ceil(($needed / $rate) * 1000.0);
        $this->_track($ctx, $wait_ms);
        $this->_sleep($wait_ms);
        $this->last = $this->_now();
        $this->tokens = 0.0;
    }

    private function _now(): float
    {
        $now = $this->options['now'] ?? null;
        if (is_callable($now)) {
            return (float)$now();
        }
        return microtime(true) * 1000.0;
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

    private function _track(ZefoyTiktokBotContext $_ctx, float $wait_ms): void
    {
        $client = $this->client;
        if (!isset($client->_ratelimit)) {
            $client->_ratelimit = ['throttled' => 0, 'waitMs' => 0.0];
        }
        $client->_ratelimit['throttled']++;
        $client->_ratelimit['waitMs'] += $wait_ms;
    }
}
