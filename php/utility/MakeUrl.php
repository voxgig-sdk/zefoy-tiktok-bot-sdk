<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_url

class ZefoyTiktokBotMakeUrl
{
    public static function call(ZefoyTiktokBotContext $ctx): array
    {
        $spec = $ctx->spec;
        $result = $ctx->result;

        if (!$spec) {
            return ['', $ctx->make_error('url_no_spec', 'Expected context spec property to be defined.')];
        }
        if (!$result) {
            return ['', $ctx->make_error('url_no_result', 'Expected context result property to be defined.')];
        }

        $url = \Voxgig\Struct\Struct::join([$spec->base, $spec->prefix, $spec->path, $spec->suffix], '/', true);
        $resmatch = [];

        $param_items = \Voxgig\Struct\Struct::items($spec->params);
        if ($param_items) {
            foreach ($param_items as $item) {
                $key = $item[0];
                $val = $item[1];
                if ($val !== null && is_string($key)) {
                    $placeholder = '{' . $key . '}';
                    $val_str = is_string($val) ? $val : (string)$val;
                    $encoded = \Voxgig\Struct\Struct::escurl($val_str);
                    $url = str_replace($placeholder, $encoded, $url);
                    $resmatch[$key] = $val;
                }
            }
        }

        // Append query string from spec.query.
        $qsep = '?';
        $query_items = \Voxgig\Struct\Struct::items($spec->query ?? null);
        if ($query_items) {
            foreach ($query_items as $item) {
                $key = $item[0];
                $val = $item[1];
                if ($val !== null && is_string($key)) {
                    $val_str = is_string($val) ? $val : (string)$val;
                    $url .= $qsep . \Voxgig\Struct\Struct::escurl($key) . '=' . \Voxgig\Struct\Struct::escurl($val_str);
                    $qsep = '&';
                    $resmatch[$key] = $val;
                }
            }
        }

        $result->resmatch = $resmatch;
        return [$url, null];
    }
}
