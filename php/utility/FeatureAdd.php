<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: feature_add

class ZefoyTiktokBotFeatureAdd
{
    public static function call(ZefoyTiktokBotContext $ctx, mixed $f): void
    {
        $features = &$ctx->client->features;

        // Features can position themselves relative to an already-added
        // feature via `_options` ("__before__" / "__after__" /
        // "__replace__"), set by the caller on `extend` feature instances —
        // mirrors the ts featureAdd. The first match wins; with no match
        // the feature is appended.
        $fopts = (is_object($f) && property_exists($f, '_options') && is_array($f->_options))
            ? $f->_options : [];
        $before = $fopts['__before__'] ?? null;
        $after = $fopts['__after__'] ?? null;
        $replace = $fopts['__replace__'] ?? null;

        if (null != $before || null != $after || null != $replace) {
            foreach ($features as $i => $ef) {
                $name = is_object($ef) && property_exists($ef, 'name') ? $ef->name : null;
                if ($before === $name) {
                    array_splice($features, $i, 0, [$f]);
                    return;
                }
                if ($after === $name) {
                    array_splice($features, $i + 1, 0, [$f]);
                    return;
                }
                if ($replace === $name) {
                    $features[$i] = $f;
                    return;
                }
            }
        }

        $features[] = $f;
    }
}
