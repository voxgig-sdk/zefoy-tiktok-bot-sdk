<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK telemetry feature

require_once __DIR__ . '/BaseFeature.php';

// Distributed-tracing telemetry. Opens a span per operation (PrePoint),
// propagates trace context to the server as W3C `traceparent` plus
// `X-Trace-Id` / `X-Span-Id` headers (PreRequest), and closes the span on
// completion (PreDone) or failure (PreUnexpected) — once per operation.
// Finished spans are kept on `client->_telemetry['spans']`; an `exporter`
// callback, when provided, is invoked with each finished span. Trace/span
// id generation (`idgen`) and the clock (`now`) are injectable for
// deterministic tests. Mirrors ts/src/feature/telemetry/TelemetryFeature.ts.
class ZefoyTiktokBotTelemetryFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private ?\WeakMap $spans;
    private int $seq;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'telemetry';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->spans = null;
        $this->seq = 0;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $this->spans = new \WeakMap();
        $this->seq = 0;

        if (!$this->active) {
            return;
        }

        $client = $this->client;
        if (!isset($client->_telemetry)) {
            $client->_telemetry = ['spans' => [], 'active' => 0];
        }
    }

    public function PrePoint(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || $this->spans === null) {
            return;
        }
        $span = [
            'traceId' => $this->_id('trace'),
            'spanId' => $this->_id('span'),
            'name' => ($ctx->op->entity !== '' ? $ctx->op->entity : '_')
                . '.' . ($ctx->op->name !== '' ? $ctx->op->name : '_'),
            'start' => $this->_now(),
            'end' => null,
            'durationMs' => null,
            'ok' => null,
        ];
        $this->spans[$ctx] = $span;
        $this->client->_telemetry['active']++;
    }

    public function PreRequest(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || $this->spans === null || !isset($this->spans[$ctx])) {
            return;
        }
        $span = $this->spans[$ctx];
        $spec = $ctx->spec;
        if ($spec === null) {
            return;
        }
        $h = $this->options['headers'] ?? [];
        if (!is_array($h)) {
            $h = [];
        }
        $spec->headers[$h['trace'] ?? 'X-Trace-Id'] = $span['traceId'];
        $spec->headers[$h['span'] ?? 'X-Span-Id'] = $span['spanId'];
        $spec->headers[$h['parent'] ?? 'traceparent'] =
            '00-' . $span['traceId'] . '-' . $span['spanId'] . '-01';
    }

    public function PreDone(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $ok = $ctx->result !== null && $ctx->result->ok !== false && $ctx->result->err === null;
        $this->_close($ctx, $ok);
    }

    public function PreUnexpected(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $this->_close($ctx, false);
    }

    private function _close(ZefoyTiktokBotContext $ctx, bool $ok): void
    {
        // Close once per operation; a PreDone followed by a pipeline failure
        // fires PreUnexpected too, which then finds no open span.
        if ($this->spans === null || !isset($this->spans[$ctx])) {
            return;
        }
        $span = $this->spans[$ctx];
        unset($this->spans[$ctx]);
        $span['end'] = $this->_now();
        $span['durationMs'] = max(0.0, (float)$span['end'] - (float)$span['start']);
        $span['ok'] = $ok;

        $client = $this->client;
        $client->_telemetry['active']--;
        $client->_telemetry['spans'][] = $span;

        $exporter = $this->options['exporter'] ?? null;
        if (is_callable($exporter)) {
            try {
                $exporter($span);
            } catch (\Throwable $_e) {
                // Exporter failures must never break the pipeline.
            }
        }
    }

    private function _id(string $kind): string
    {
        $idgen = $this->options['idgen'] ?? null;
        if (is_callable($idgen)) {
            return (string)$idgen($kind);
        }
        // Deterministic-ish sequential id; unique within a client instance.
        $this->seq++;
        $n = str_pad(dechex($this->seq), 4, '0', STR_PAD_LEFT);
        return ($kind === 'trace' ? 't' : 's') . str_pad($n, 16, '0', STR_PAD_RIGHT);
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
