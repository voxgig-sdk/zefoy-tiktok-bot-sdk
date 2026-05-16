<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_options

class ZefoyTiktokBotMakeOptions
{
    private static function to_array_deep(mixed $val): mixed
    {
        if ($val instanceof \Closure) {
            return $val;
        }
        if (is_object($val)) {
            $val = (array)$val;
        }
        if (is_array($val)) {
            foreach ($val as $k => $v) {
                if (is_object($v) || is_array($v)) {
                    $val[$k] = self::to_array_deep($v);
                }
            }
        }
        return $val;
    }

    public static function call(ZefoyTiktokBotContext $ctx): array
    {
        $options = $ctx->options ?? [];

        $custom_utils = \Voxgig\Struct\Struct::getprop($options, 'utility');
        if ((is_array($custom_utils) || is_object($custom_utils)) && $ctx->utility) {
            foreach ((array)$custom_utils as $k => $v) {
                $ctx->utility->custom[$k] = $v;
            }
        }

        // Preserve system.fetch before merge/validate.
        $sys_fetch = \Voxgig\Struct\Struct::getpath($options, 'system.fetch');

        $opts = \Voxgig\Struct\Struct::clone($options);
        $opts = self::to_array_deep($opts);
        if (!is_array($opts)) {
            $opts = [];
        }

        $config = $ctx->config ?? [];
        $cfgopts = isset($config['options']) && is_array($config['options']) ? $config['options'] : [];

        $optspec = [
            'apikey' => '',
            'base' => 'http://localhost:8000',
            'prefix' => '',
            'suffix' => '',
            'auth' => ['prefix' => ''],
            'headers' => ['`$CHILD`' => '`$STRING`'],
            'allow' => [
                'method' => 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
                'op' => 'create,update,load,list,remove,command,direct',
            ],
            'entity' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false, 'alias' => (object)[]]],
            'feature' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false]],
            'utility' => (object)[],
            'system' => (object)[],
            'test' => ['active' => false, 'entity' => ['`$OPEN`' => true]],
            'clean' => ['keys' => 'key,token,id'],
        ];

        // Empty [] would be treated as a list and clobber the map under merge;
        // substitute an empty stdClass to preserve map semantics.
        $cfgopts_merge = empty($cfgopts) ? new \stdClass() : $cfgopts;
        $opts_merge = empty($opts) ? new \stdClass() : $opts;
        $merged = \Voxgig\Struct\Struct::merge([(object)[], $cfgopts_merge, $opts_merge]);
        $validated = \Voxgig\Struct\Struct::validate($merged, $optspec);
        $opts = self::to_array_deep($validated);
        if (!is_array($opts)) {
            $opts = [];
        }

        if ($sys_fetch) {
            if (!is_array($opts['system'] ?? null)) {
                $opts['system'] = [];
            }
            $opts['system']['fetch'] = $sys_fetch;
        }

        $clean_keys = \Voxgig\Struct\Struct::getpath($opts, 'clean.keys');
        if (!is_string($clean_keys)) {
            $clean_keys = 'key,token,id';
        }
        $parts = array_filter(array_map('trim', explode(',', $clean_keys)), function ($p) {
            return $p !== '';
        });
        $parts = array_map(function ($p) {
            return \Voxgig\Struct\Struct::escre($p);
        }, $parts);
        $keyre = implode('|', $parts);
        $derived = ['clean' => $keyre === '' ? [] : ['keyre' => $keyre]];
        $opts['__derived__'] = $derived;

        return $opts;
    }
}
