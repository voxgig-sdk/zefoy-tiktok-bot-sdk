<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK debug feature

require_once __DIR__ . '/BaseFeature.php';

// Request/response capture for debugging. Records a bounded ring buffer of
// per-operation traces — method, URL, redacted headers, response status and
// timing — on `client->_debug['entries']`. Sensitive header values
// (matching `redact`, default authorization/cookie/api-key style names) are
// masked. An optional `onEntry` callback receives each finished entry (e.g.
// to stream to a console). `max` caps the buffer (default 100). Mirrors
// ts/src/feature/debug/DebugFeature.ts.
class ZefoyTiktokBotDebugFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private ?\WeakMap $entries;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'debug';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->entries = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $this->entries = new \WeakMap();

        if (!$this->active) {
            return;
        }

        $client = $this->client;
        if (!isset($client->_debug)) {
            $client->_debug = ['entries' => []];
        }
    }

    public function PreRequest(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || $this->entries === null) {
            return;
        }
        $spec = $ctx->spec;
        $entry = [
            'op' => ($ctx->op->entity !== '' ? $ctx->op->entity : '_')
                . '.' . ($ctx->op->name !== '' ? $ctx->op->name : '_'),
            'method' => $spec !== null ? $spec->method : null,
            'url' => $spec !== null ? ($spec->url !== '' ? $spec->url : $spec->path) : null,
            'headers' => $this->_redact($spec !== null ? $spec->headers : null),
            'start' => $this->_now(),
            'status' => null,
            'ok' => null,
            'durationMs' => null,
            'error' => null,
        ];
        $this->entries[$ctx] = $entry;
    }

    public function PreResponse(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || $this->entries === null || !isset($this->entries[$ctx])) {
            return;
        }
        $entry = $this->entries[$ctx];
        $response = $ctx->response;
        if ($response !== null) {
            $entry['status'] = $response->status;
            if (($entry['url'] === null || $entry['url'] === '') && $ctx->spec !== null) {
                $entry['url'] = $ctx->spec->url;
            }
            // PHP arrays are value types: write the updated entry back.
            $this->entries[$ctx] = $entry;
        }
    }

    public function PreDone(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $this->_finish($ctx, true);
    }

    public function PreUnexpected(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        if ($this->entries !== null && isset($this->entries[$ctx])) {
            $entry = $this->entries[$ctx];
            $err = $ctx->ctrl->err;
            $entry['error'] = ($err instanceof \Throwable) ? $err->getMessage() : null;
            $this->entries[$ctx] = $entry;
        }
        $this->_finish($ctx, false);
    }

    private function _finish(ZefoyTiktokBotContext $ctx, bool $ok): void
    {
        // Finish once per operation: a PreDone followed by an unexpected
        // failure finds no open entry and no-ops.
        if ($this->entries === null || !isset($this->entries[$ctx])) {
            return;
        }
        $entry = $this->entries[$ctx];
        unset($this->entries[$ctx]);

        $entry['ok'] = $ok && ($ctx->result === null || $ctx->result->ok !== false);
        $entry['durationMs'] = max(0.0, $this->_now() - (float)$entry['start']);
        if ($entry['status'] === null && $ctx->result !== null) {
            $entry['status'] = $ctx->result->status;
        }

        $client = $this->client;
        $client->_debug['entries'][] = $entry;
        $max = is_numeric($this->options['max'] ?? null) ? (int)$this->options['max'] : 100;
        while (count($client->_debug['entries']) > $max) {
            array_shift($client->_debug['entries']);
        }

        $on_entry = $this->options['onEntry'] ?? null;
        if (is_callable($on_entry)) {
            try {
                $on_entry($entry);
            } catch (\Throwable $_e) {
                // Callback failures must never break the pipeline.
            }
        }
    }

    private function _redact(mixed $headers): array
    {
        if (!is_array($headers)) {
            return [];
        }
        $patterns = $this->options['redact'] ??
            ['authorization', 'cookie', 'set-cookie', 'api-key', 'apikey', 'x-api-key', 'idempotency-key'];
        if (!is_array($patterns)) {
            $patterns = [];
        }
        $out = [];
        foreach ($headers as $k => $v) {
            $out[$k] = in_array(strtolower((string)$k), $patterns, true) ? '<redacted>' : $v;
        }
        return $out;
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
