<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: feature_add

class ZefoyTiktokBotFeatureAdd
{
    public static function call(ZefoyTiktokBotContext $ctx, mixed $f): void
    {
        $ctx->client->features[] = $f;
    }
}
