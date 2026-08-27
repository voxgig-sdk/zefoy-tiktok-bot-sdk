<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK control

class ZefoyTiktokBotControl
{
    public mixed $throw_err;
    public mixed $err;
    public mixed $explain;

    // Per-call actor, read by the `audit` and `cost` features to attribute an
    // operation to whoever asked for it.
    //
    // Declared, because this class is typed. ts carries it without declaring
    // it - its control object is open, so a caller-supplied `actor` simply
    // survives - and both features were written against that, commenting it
    // as "an optional extension property on the control". Here the property
    // did not exist, so `$ctx->ctrl->actor ?? null` was always null and every
    // operation was attributed to 'anonymous' no matter what the caller
    // passed. The shared feature corpus caught it.
    public mixed $actor;

    public function __construct(array $opts = [])
    {
        $this->throw_err = $opts['throw_err'] ?? null;
        $this->err = null;
        $this->explain = $opts['explain'] ?? null;
        $this->actor = $opts['actor'] ?? null;
    }
}
