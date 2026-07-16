<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK rbac feature

require_once __DIR__ . '/BaseFeature.php';

// Client-side role/permission enforcement. Before an operation resolves its
// endpoint, the required permission for that entity+operation is checked
// against the permissions the client holds; a disallowed call is
// short-circuited with an `rbac_denied` error and never touches the
// network. Required permissions come from `rules` (keyed by
// `<entity>.<op>`, `<op>`, or `*`); the default when no rule matches is
// controlled by `deny` (default: allow when unspecified). Held permissions
// are the `permissions` list (a `*` grants everything).
//
// The short-circuit places the error in `$ctx->out['point']`; the
// `make_point` utility surfaces it as the pipeline error before any
// endpoint resolution (the PHP analogue of the TS `ctx.out.point` Error
// check). Mirrors ts/src/feature/rbac/RbacFeature.ts.
class ZefoyTiktokBotRbacFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private array $granted;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'rbac';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->granted = [];
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        $this->granted = [];
        $perms = $options['permissions'] ?? [];
        if (is_array($perms)) {
            foreach ($perms as $p) {
                if (is_string($p)) {
                    $this->granted[$p] = true;
                }
            }
        }
    }

    public function PrePoint(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }

        $required = $this->_required($ctx);
        if ($required === null) {
            // No rule: honour the default policy.
            if (($this->options['deny'] ?? null) === true) {
                $this->_reject($ctx, '<default-deny>');
            }
            return;
        }

        if (($this->granted['*'] ?? false) || ($this->granted[$required] ?? false)) {
            $this->_track($ctx, $required, true);
            return;
        }

        $this->_reject($ctx, $required);
    }

    private function _required(ZefoyTiktokBotContext $ctx): ?string
    {
        $rules = $this->options['rules'] ?? [];
        if (!is_array($rules)) {
            $rules = [];
        }

        $entity = '';
        $e = $ctx->entity;
        if (is_object($e) && method_exists($e, 'get_name')) {
            $entity = (string)$e->get_name();
        } elseif (is_array($e) && is_string($e['name'] ?? null)) {
            $entity = $e['name'];
        }
        if ($entity === '' && $ctx->op->entity !== '_') {
            $entity = $ctx->op->entity;
        }
        $opname = $ctx->op->name;

        if (isset($rules[$entity . '.' . $opname])) {
            return (string)$rules[$entity . '.' . $opname];
        }
        if (isset($rules[$opname])) {
            return (string)$rules[$opname];
        }
        if (isset($rules['*'])) {
            return (string)$rules['*'];
        }
        return null;
    }

    private function _reject(ZefoyTiktokBotContext $ctx, string $required): void
    {
        $this->_track($ctx, $required, false);
        $opname = $ctx->op->name !== '' ? $ctx->op->name : '?';
        $err = $ctx->make_error('rbac_denied',
            "Permission \"{$required}\" required for operation \"{$opname}\"");
        // Short-circuit endpoint resolution; make_point surfaces this error
        // to the pipeline before any network activity.
        $ctx->out['point'] = $err;
    }

    private function _track(ZefoyTiktokBotContext $ctx, string $required, bool $allowed): void
    {
        $client = $this->client;
        if (!isset($client->_rbac)) {
            $client->_rbac = ['allowed' => 0, 'denied' => 0, 'last' => null];
        }
        $client->_rbac[$allowed ? 'allowed' : 'denied']++;
        $client->_rbac['last'] = [
            'required' => $required,
            'allowed' => $allowed,
            'op' => $ctx->op->name,
        ];
    }
}
