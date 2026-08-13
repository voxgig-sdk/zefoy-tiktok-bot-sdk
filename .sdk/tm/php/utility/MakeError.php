<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_error

require_once __DIR__ . '/../core/Operation.php';
require_once __DIR__ . '/../core/Result.php';
require_once __DIR__ . '/../core/Error.php';

class ZefoyTiktokBotMakeError
{
    public static function call(?ZefoyTiktokBotContext $ctx, mixed $err): mixed
    {
        if ($ctx === null) {
            require_once __DIR__ . '/../core/Context.php';
            $ctx = new ZefoyTiktokBotContext([], null);
        }
        $op = $ctx->op ?? new ZefoyTiktokBotOperation([]);
        $opname = $op->name;
        if ($opname === '' || $opname === '_') {
            $opname = 'unknown operation';
        }

        $result = $ctx->result ?? new ZefoyTiktokBotResult([]);
        $result->ok = false;

        if ($err === null) {
            $err = $result->err;
        }
        if ($err === null) {
            $err = $ctx->make_error('unknown', 'unknown error');
        }

        $errmsg = ($err instanceof ZefoyTiktokBotError) ? $err->msg : (string)$err;
        $msg = "ZefoyTiktokBotSDK: {$opname}: {$errmsg}";
        $msg = ($ctx->utility->clean)($ctx, $msg);

        $result->err = null;
        $spec = $ctx->spec;

        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['err'] = ['message' => $msg];
        }

        $sdk_err = new ZefoyTiktokBotError('', $msg, $ctx);
        $sdk_err->result = ($ctx->utility->clean)($ctx, $result);
        $sdk_err->spec = ($ctx->utility->clean)($ctx, $spec);

        // Promote the HTTP status to the top level, so a consumer can branch
        // on `err->status` / `err->notFound()` rather than reaching into
        // `err->result`.
        $sdk_err->status = null === $result->status ? -1 : (int)$result->status;
        if ($err instanceof ZefoyTiktokBotError) {
            $sdk_err->sdk_code = $err->sdk_code;
        }

        $ctx->ctrl->err = $sdk_err;

        // Fire PreUnexpected so observability features (metrics, telemetry,
        // audit, debug) close/record error paths that never reach PreDone
        // (e.g. a PrePoint rbac short-circuit). Fires after ctx.ctrl.err is set
        // so hooks can read the error; features guard against double-recording
        // when PreDone already fired.
        if (isset($ctx->utility) && isset($ctx->utility->feature_hook)) {
            ($ctx->utility->feature_hook)($ctx, "PreUnexpected");
        }

        if ($ctx->ctrl->throw_err === false) {
            return $result->resdata;
        }
        throw $sdk_err;
    }
}
