<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK cache feature

require_once __DIR__ . '/BaseFeature.php';

// Response caching for safe (read) requests. Wraps the active transport and
// serves a fresh cached snapshot instead of hitting the network when the
// same method+URL was fetched within `ttl` ms (default 5000). Only
// successful (2xx) responses to cacheable methods (default: GET) are
// stored, keyed by method+URL. The cache is bounded (`max` entries, default
// 256, oldest evicted first) and every hit/miss/bypass is recorded on
// `client->_cache` for inspection. Snapshots replay through a fresh `json`
// closure so both the current caller and later hits can read the body
// repeatedly. Mirrors ts/src/feature/cache/CacheFeature.ts.
class ZefoyTiktokBotCacheFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private array $store;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'cache';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->store = [];
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        if (!$this->active) {
            return;
        }

        $this->store = [];

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ZefoyTiktokBotContext $ctx2, string $url, array $fetchdef) use ($inner): array {
            return $this->_through($ctx2, $url, $fetchdef, $inner);
        };
    }

    private function _through(ZefoyTiktokBotContext $ctx, string $url, array $fetchdef, callable $inner): array
    {
        $method = strtoupper((string)($fetchdef['method'] ?? 'GET'));
        $methods = $this->options['methods'] ?? ['GET'];

        if (!is_array($methods) || !in_array($method, $methods, true)) {
            return $inner($ctx, $url, $fetchdef);
        }

        $key = $method . ' ' . $url;
        $now = $this->_now();
        $hit = $this->store[$key] ?? null;

        if ($hit !== null && $hit['expiry'] > $now) {
            $this->_track('hit');
            return [$this->_replay($hit['snapshot']), null];
        }

        [$res, $err] = $inner($ctx, $url, $fetchdef);

        if ($this->_cacheable($res, $err)) {
            $snapshot = $this->_snapshot($res);
            $ttl = is_numeric($this->options['ttl'] ?? null) ? (float)$this->options['ttl'] : 5000.0;
            $this->_evict();
            $this->store[$key] = ['expiry' => $now + $ttl, 'snapshot' => $snapshot];
            $this->_track('miss');
            return [$this->_replay($snapshot), null];
        }

        $this->_track('bypass');
        return [$res, $err];
    }

    private function _cacheable(mixed $res, mixed $err): bool
    {
        if ($err !== null || !is_array($res)) {
            return false;
        }
        $status = $res['status'] ?? null;
        return is_numeric($status) && (int)$status >= 200 && (int)$status < 300;
    }

    private function _snapshot(array $res): array
    {
        $data = null;
        $jf = $res['json'] ?? null;
        if (is_callable($jf)) {
            try {
                $data = $jf();
            } catch (\Throwable $_e) {
                $data = null;
            }
        }
        $headers = is_array($res['headers'] ?? null) ? $res['headers'] : [];
        return [
            'status' => $res['status'] ?? null,
            'statusText' => $res['statusText'] ?? '',
            'data' => $data,
            'headers' => $headers,
        ];
    }

    private function _replay(array $snapshot): array
    {
        $data = $snapshot['data'];
        return [
            'status' => $snapshot['status'],
            'statusText' => $snapshot['statusText'],
            'body' => 'not-used',
            // Fresh closure per replay: the body is re-readable on every hit.
            'json' => function () use ($data) { return $data; },
            'headers' => $snapshot['headers'],
        ];
    }

    private function _evict(): void
    {
        $max = is_numeric($this->options['max'] ?? null) ? (int)$this->options['max'] : 256;
        while (count($this->store) >= $max) {
            $oldest = array_key_first($this->store);
            if ($oldest === null) {
                break;
            }
            unset($this->store[$oldest]);
        }
    }

    private function _now(): float
    {
        $now = $this->options['now'] ?? null;
        if (is_callable($now)) {
            return (float)$now();
        }
        return microtime(true) * 1000.0;
    }

    private function _track(string $kind): void
    {
        $client = $this->client;
        if (!isset($client->_cache)) {
            $client->_cache = ['hit' => 0, 'miss' => 0, 'bypass' => 0];
        }
        $client->_cache[$kind]++;
    }
}
