<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK metrics feature

require_once __DIR__ . '/BaseFeature.php';

// Statistics capture. Records per-operation counters and latency for every
// call: totals plus a breakdown keyed by `<entity>.<op>`. Timing starts at
// endpoint resolution (PrePoint) and stops when the call returns (PreDone)
// or fails (PreUnexpected) — exactly once per operation (a PreDone followed
// by an unexpected failure finds no start marker and no-ops). Aggregates
// live on `client->_metrics`. The clock is injectable (`now`) for
// deterministic tests. Mirrors ts/src/feature/metrics/MetricsFeature.ts.
class ZefoyTiktokBotMetricsFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private ?\WeakMap $starts;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'metrics';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->starts = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $this->starts = new \WeakMap();

        if (!$this->active) {
            return;
        }

        $client = $this->client;
        if (!isset($client->_metrics)) {
            $client->_metrics = [
                'total' => ['count' => 0, 'ok' => 0, 'err' => 0, 'totalMs' => 0.0, 'maxMs' => 0.0],
                'ops' => [],
            ];
        }
    }

    public function PrePoint(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || $this->starts === null) {
            return;
        }
        $this->starts[$ctx] = $this->_now();
    }

    public function PreDone(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        // Classify by the actual result: a 4xx/5xx that flows through still
        // reaches PreDone before the pipeline raises.
        $ok = $ctx->result !== null && $ctx->result->ok !== false && $ctx->result->err === null;
        $this->_record($ctx, $ok);
    }

    public function PreUnexpected(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $this->_record($ctx, false);
    }

    private function _record(ZefoyTiktokBotContext $ctx, bool $ok): void
    {
        // Record once per operation. When a non-2xx result reaches PreDone the
        // pipeline then raises, firing PreUnexpected too; the missing start
        // marker makes the second call a no-op.
        if ($this->starts === null || !isset($this->starts[$ctx])) {
            return;
        }
        $start = $this->starts[$ctx];
        $dur = max(0.0, $this->_now() - (float)$start);
        unset($this->starts[$ctx]);

        $client = $this->client;
        $key = ($ctx->op->entity !== '' ? $ctx->op->entity : '_')
            . '.' . ($ctx->op->name !== '' ? $ctx->op->name : '_');

        if (!isset($client->_metrics['ops'][$key])) {
            $client->_metrics['ops'][$key] =
                ['count' => 0, 'ok' => 0, 'err' => 0, 'totalMs' => 0.0, 'maxMs' => 0.0];
        }

        $this->_bump($client->_metrics['total'], $ok, $dur);
        $this->_bump($client->_metrics['ops'][$key], $ok, $dur);
    }

    private function _bump(array &$bucket, bool $ok, float $dur): void
    {
        $bucket['count']++;
        $bucket[$ok ? 'ok' : 'err']++;
        $bucket['totalMs'] += $dur;
        if ($dur > $bucket['maxMs']) {
            $bucket['maxMs'] = $dur;
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
}
