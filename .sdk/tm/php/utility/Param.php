<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: param

require_once __DIR__ . '/../core/Helpers.php';

class ZefoyTiktokBotParam
{
    public static function call(ZefoyTiktokBotContext $ctx, mixed $paramdef): mixed
    {
        $point = $ctx->point;
        $spec = $ctx->spec;
        $match_val = $ctx->match;
        $reqmatch = $ctx->reqmatch;
        $data = $ctx->data;
        $reqdata = $ctx->reqdata;

        $pt = \Voxgig\Struct\Struct::typify($paramdef);
        if ((\Voxgig\Struct\Struct::T_string & $pt) > 0) {
            $key = $paramdef;
        } else {
            $k = \Voxgig\Struct\Struct::getprop($paramdef, 'name');
            $key = is_string($k) ? $k : '';
        }

        $akey = '';
        if ($point) {
            $alias_map = ZefoyTiktokBotHelpers::to_map(\Voxgig\Struct\Struct::getprop($point, 'alias'));
            if ($alias_map) {
                $ak = \Voxgig\Struct\Struct::getprop($alias_map, $key);
                if (is_string($ak)) {
                    $akey = $ak;
                }
            }
        }

        $undef = '__UNDEFINED__';

        $val = \Voxgig\Struct\Struct::getprop($reqmatch, $key);
        if ($val === null || $val === $undef) {
            $val = \Voxgig\Struct\Struct::getprop($match_val, $key);
        }

        if (($val === null || $val === $undef) && $akey !== '') {
            if ($spec) {
                $spec->alias_map[$akey] = $key;
            }
            $val = \Voxgig\Struct\Struct::getprop($reqmatch, $akey);
        }

        if ($val === null || $val === $undef) {
            $val = \Voxgig\Struct\Struct::getprop($reqdata, $key);
        }
        if ($val === null || $val === $undef) {
            $val = \Voxgig\Struct\Struct::getprop($data, $key);
        }

        if (($val === null || $val === $undef) && $akey !== '') {
            $val = \Voxgig\Struct\Struct::getprop($reqdata, $akey);
            if ($val === null || $val === $undef) {
                $val = \Voxgig\Struct\Struct::getprop($data, $akey);
            }
        }

        return ($val === $undef) ? null : $val;
    }
}
