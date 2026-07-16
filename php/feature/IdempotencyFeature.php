<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK idempotency feature

require_once __DIR__ . '/BaseFeature.php';

// Idempotency keys for mutating operations. Adds an `Idempotency-Key`
// header (name configurable via `header`) to unsafe requests so a server
// can de-duplicate retried writes. The key is set once, at PreRequest,
// before the request is built — so it is stable across transport-level
// retries of the same call. A caller-supplied header (any letter case) is
// never overwritten. The key generator is injectable (`keygen`) for
// deterministic tests. Mirrors
// ts/src/feature/idempotency/IdempotencyFeature.ts.
class ZefoyTiktokBotIdempotencyFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'idempotency';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
    }

    public function PreRequest(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $spec = $ctx->spec;
        if ($spec === null) {
            return;
        }

        if (!$this->_mutating($ctx)) {
            return;
        }

        $header = $this->options['header'] ?? 'Idempotency-Key';
        $header = is_string($header) && $header !== '' ? $header : 'Idempotency-Key';

        // Respect a key the caller already provided.
        if ($this->_existing($spec->headers, $header) !== null) {
            return;
        }

        $key = $this->_genkey();
        $spec->headers[$header] = $key;

        $client = $this->client;
        if (!isset($client->_idempotency)) {
            $client->_idempotency = ['issued' => 0, 'last' => null];
        }
        $client->_idempotency['issued']++;
        $client->_idempotency['last'] = $key;
    }

    private function _mutating(ZefoyTiktokBotContext $ctx): bool
    {
        $methods = $this->options['methods'] ?? ['POST', 'PUT', 'PATCH', 'DELETE'];
        $method = strtoupper((string)($ctx->spec !== null ? $ctx->spec->method : ''));
        if ($method !== '' && is_array($methods) && in_array($method, $methods, true)) {
            return true;
        }
        $opname = $ctx->op->name;
        $ops = $this->options['ops'] ?? ['create', 'update', 'remove'];
        return is_array($ops) && in_array($opname, $ops, true);
    }

    private function _existing(array $headers, string $header): mixed
    {
        $lower = strtolower($header);
        foreach ($headers as $k => $v) {
            if (is_string($k) && strtolower($k) === $lower) {
                return $v;
            }
        }
        return null;
    }

    private function _genkey(): string
    {
        $keygen = $this->options['keygen'] ?? null;
        if (is_callable($keygen)) {
            return (string)$keygen();
        }
        return bin2hex(random_bytes(12));
    }
}
