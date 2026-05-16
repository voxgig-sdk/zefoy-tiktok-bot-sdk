<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_context

require_once __DIR__ . '/../core/Context.php';

class ZefoyTiktokBotMakeContext
{
    public static function call(array $ctxmap, ?ZefoyTiktokBotContext $basectx): ZefoyTiktokBotContext
    {
        return new ZefoyTiktokBotContext($ctxmap, $basectx);
    }
}
