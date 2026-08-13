<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: prepare_method

class ZefoyTiktokBotPrepareMethod
{
    private const METHOD_MAP = [
        'create' => 'POST',
        'update' => 'PUT',
        'load' => 'GET',
        'list' => 'GET',
        'remove' => 'DELETE',
        'patch' => 'PATCH',
    ];

    public static function call(ZefoyTiktokBotContext $ctx): string
    {
        // The API definition is authoritative: a POST-only or PATCH-based API
        // exposes `update` as POST or PATCH, not the PUT the op name implies.
        // Only fall back to the op-name convention when the point has no method.
        $point = $ctx->point;
        if ($point) {
            $method = \Voxgig\Struct\Struct::getprop($point, 'method');
            if (is_string($method) && '' !== $method) {
                return strtoupper($method);
            }
        }

        return self::METHOD_MAP[$ctx->op->name] ?? 'GET';
    }
}
