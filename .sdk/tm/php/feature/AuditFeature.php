<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK audit feature

require_once __DIR__ . '/BaseFeature.php';

// Audit trail. Emits one structured record per operation — who (actor),
// what (entity + op), the outcome, and a correlation id — suitable for
// compliance logging. Records accumulate on `client->_audit['records']`
// (bounded by `max`, default 1000) and, when a `sink` callback is supplied,
// are also pushed to it (e.g. to forward to a SIEM). The actor is taken
// from a per-call `ctrl->actor`, then options `actor`, then 'anonymous'.
// Timestamps use the injectable `now` clock so tests stay deterministic.
// Mirrors ts/src/feature/audit/AuditFeature.ts.
class ZefoyTiktokBotAuditFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private int $seq;
    private ?\WeakMap $seen;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'audit';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->seq = 0;
        $this->seen = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $this->seq = 0;
        $this->seen = new \WeakMap();

        if (!$this->active) {
            return;
        }

        $client = $this->client;
        if (!isset($client->_audit)) {
            $client->_audit = ['records' => []];
        }
    }

    public function PreDone(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        // Outcome reflects the actual result; a non-2xx reaches PreDone
        // before the pipeline raises.
        $ok = $ctx->result !== null && $ctx->result->ok !== false && $ctx->result->err === null;
        $this->_emit($ctx, $ok ? 'ok' : 'error');
    }

    public function PreUnexpected(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $this->_emit($ctx, 'error');
    }

    private function _emit(ZefoyTiktokBotContext $ctx, string $outcome): void
    {
        // One record per operation (PreDone + a following PreUnexpected on a
        // non-2xx must not double-log).
        if ($this->seen === null || isset($this->seen[$ctx])) {
            return;
        }
        $this->seen[$ctx] = true;
        $this->seq++;

        // ctrl->actor is an optional extension property on the control
        // object; absent means "not set per call".
        $ctrl_actor = $ctx->ctrl->actor ?? null;
        $actor = (is_string($ctrl_actor) && $ctrl_actor !== '') ? $ctrl_actor
            : ($this->options['actor'] ?? null);
        $actor = (is_string($actor) && $actor !== '') ? $actor : 'anonymous';

        $record = [
            'seq' => $this->seq,
            'ts' => $this->_now(),
            'actor' => $actor,
            'entity' => $ctx->op->entity !== '' ? $ctx->op->entity : '_',
            'op' => $ctx->op->name !== '' ? $ctx->op->name : '_',
            'outcome' => $outcome,
            'status' => $ctx->result !== null ? $ctx->result->status : null,
            'correlationId' => $ctx->id,
        ];

        $client = $this->client;
        $client->_audit['records'][] = $record;
        $max = is_numeric($this->options['max'] ?? null) ? (int)$this->options['max'] : 1000;
        while (count($client->_audit['records']) > $max) {
            array_shift($client->_audit['records']);
        }

        $sink = $this->options['sink'] ?? null;
        if (is_callable($sink)) {
            try {
                $sink($record);
            } catch (\Throwable $_e) {
                // Sink failures must never break the pipeline.
            }
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
