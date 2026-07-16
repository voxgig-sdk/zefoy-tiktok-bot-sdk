<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK retry feature

require_once __DIR__ . '/BaseFeature.php';

// Automatic retry of transient failures with exponential backoff and
// jitter. Wraps the active transport so a single operation call may make
// several HTTP attempts. A failure is retryable when the transport returns
// an error (or throws), or responds with a status in `statuses`
// (default: 408, 425, 429, 500, 502, 503, 504). An HTTP 429/503 with a
// `Retry-After` header overrides the computed backoff.
// Mirrors ts/src/feature/retry/RetryFeature.ts.
class ZefoyTiktokBotRetryFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'retry';
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
            return $this->_with_retry($ctx2, $url, $fetchdef, $inner);
        };
    }

    private function _with_retry(ZefoyTiktokBotContext $ctx, string $url, array $fetchdef, callable $inner): array
    {
        $opts = $this->options ?? [];
        $max = is_numeric($opts['retries'] ?? null) ? (int)$opts['retries'] : 2;
        $min_delay = is_numeric($opts['minDelay'] ?? null) ? (float)$opts['minDelay'] : 50.0;
        $max_delay = is_numeric($opts['maxDelay'] ?? null) ? (float)$opts['maxDelay'] : 2000.0;
        $factor = is_numeric($opts['factor'] ?? null) ? (float)$opts['factor'] : 2.0;

        $attempt = 0;

        while (true) {
            $res = null;
            $err = null;
            try {
                [$res, $err] = $inner($ctx, $url, $fetchdef);
            } catch (\Throwable $e) {
                $res = null;
                $err = $e;
            }

            $retryable = $this->_retryable($res, $err);
            if (!$retryable || $attempt >= $max) {
                // Out of attempts: return the last response/error tuple to
                // preserve pipeline semantics.
                return [$res, $err];
            }

            $wait = $this->_backoff($res, $attempt, $min_delay, $max_delay, $factor);
            $this->_track($ctx, $attempt + 1, $res, $err, $wait);
            $this->_sleep($wait);
            $attempt++;
        }
    }

    private function _retryable(mixed $res, mixed $err): bool
    {
        // A transport-level error (error tuple member or thrown) is retryable.
        if ($err !== null) {
            return true;
        }
        if ($res === null) {
            return true;
        }
        $status = is_array($res) ? ($res['status'] ?? null) : null;
        if (!is_numeric($status)) {
            return false;
        }
        $statuses = $this->options['statuses'] ?? [408, 425, 429, 500, 502, 503, 504];
        return is_array($statuses) && in_array((int)$status, array_map('intval', $statuses), true);
    }

    private function _backoff(mixed $res, int $attempt, float $min_delay, float $max_delay, float $factor): float
    {
        // Honour a server-provided Retry-After (seconds) when present.
        $ra = $this->_retry_after($res);
        if ($ra !== null) {
            return min($max_delay, $ra);
        }
        $base = $min_delay * pow($factor, $attempt);
        $jitter = ($this->options['jitter'] ?? null) === false
            ? 0.0
            : (float)mt_rand(0, max(0, (int)$min_delay - 1));
        return min($max_delay, $base + $jitter);
    }

    private function _retry_after(mixed $res): ?float
    {
        if (!is_array($res) || !is_array($res['headers'] ?? null)) {
            return null;
        }
        $v = null;
        foreach ($res['headers'] as $k => $hv) {
            if (is_string($k) && strcasecmp($k, 'retry-after') === 0) {
                $v = $hv;
                break;
            }
        }
        if ($v === null || !is_numeric($v)) {
            return null;
        }
        return (float)$v * 1000.0;
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

    private function _track(ZefoyTiktokBotContext $_ctx, int $attempt, mixed $res, mixed $err, float $wait): void
    {
        $client = $this->client;
        if (!isset($client->_retry)) {
            $client->_retry = ['attempts' => 0, 'retries' => []];
        }
        $client->_retry['attempts']++;
        $client->_retry['retries'][] = [
            'attempt' => $attempt,
            'status' => is_array($res) ? ($res['status'] ?? null) : null,
            'error' => ($err instanceof \Throwable) ? $err->getMessage()
                : (is_string($err) ? $err : null),
            'wait' => $wait,
        ];
    }
}
