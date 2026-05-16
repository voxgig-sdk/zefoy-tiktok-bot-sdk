<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: prepare_body

class ZefoyTiktokBotPrepareBody
{
    public static function call(ZefoyTiktokBotContext $ctx): mixed
    {
        if ($ctx->op->input === 'data') {
            return ($ctx->utility->transform_request)($ctx);
        }
        return null;
    }
}
