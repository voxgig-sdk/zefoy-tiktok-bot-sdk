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

        // Merge custom utility overrides.
        //
        // A key naming a real utility member REPLACES it; anything else is
        // attached as a custom extra. This mirrors ts, where the utility is an
        // open object and one setprop does both.
        //
        // Without the replace half this was a no-op: every entry went to
        // `utility->custom`, which nothing reads, so a caller passing
        // `'utility' => ['fetcher' => $myTransport]` - the documented way to
        // script the transport, and the seam the shared feature corpus runs
        // on - was silently ignored while ts and js honoured it.
        //
        // Option keys are camelCase, as ts spells them; members here are
        // snake_case. Converting rather than listing keeps the mapping to one
        // rule, so a utility added later is overridable without touching this.
        $custom_utils = \Voxgig\Struct\Struct::getprop($options, 'utility');
        if ((is_array($custom_utils) || is_object($custom_utils)) && $ctx->utility) {
            $utility = $ctx->utility;
            foreach ((array)$custom_utils as $k => $v) {
                // Public utility names are camelCase and carry no underscore,
                // so an underscore means the caller named something of their
                // own - possibly the INTERNAL spelling of a real member.
                // `make_error` must stay an extension in `custom`; replacing
                // the pipeline function with it (ts, js and go all keep it)
                // would break the error path on the next request, silently.
                $public_name = false === strpos((string)$k, '_');
                $member = strtolower(preg_replace('/([A-Z])/', '_$1', (string)$k));
                if ($public_name && 'custom' !== $member
                    && property_exists($utility, $member)) {
                    $utility->$member = $v;
                } else {
                    $utility->custom[$k] = $v;
                }
            }
        }

        // Preserve system.fetch before merge/validate.
        $sys_fetch = \Voxgig\Struct\Struct::getpath($options, 'system.fetch');

        // Feature INSTANCES supplied at construction (the station adopt path)
        // are consumed by the constructor's feature-add loop straight from the
        // RAW construction options - extend is consumed exactly once, at
        // construction. Strip it here so it never enters the cloned option
        // map: Struct::clone flattens arbitrary objects, and options_map()
        // re-clones $this->options on every request.
        if (isset($options['extend'])) {
            unset($options['extend']);
        }

        // The station feature's binding handle and caller opts are live
        // values (connect/adopt/st->options() plant them): hold them aside so
        // the clone below cannot flatten them, and reattach after validate.
        $station_handle = null;
        $station_caller = null;
        $station_has_caller = false;
        if (is_array($options['feature']['station'] ?? null)) {
            if (is_object($options['feature']['station']['station'] ?? null)) {
                $station_handle = $options['feature']['station']['station'];
                unset($options['feature']['station']['station']);
            }
            if (array_key_exists('calleropts', $options['feature']['station'])) {
                $station_caller = $options['feature']['station']['calleropts'];
                $station_has_caller = true;
                unset($options['feature']['station']['calleropts']);
            }
        }

        $opts = \Voxgig\Struct\Struct::clone($options);
        $opts = self::to_array_deep($opts);
        if (!is_array($opts)) {
            $opts = [];
        }

        // Feature add-order. options['feature'] may be given as an ordered LIST
        // of ['name'=>..., 'active'=>..., ...] entries (the list position IS the
        // order in which features are added), or as a ['name'=>[opts]] map.
        // Normalize a list to a map (so merge/validate/init are unchanged) and
        // remember the explicit order; a map defaults to test-first so the
        // `test` mock transport is installed as the base of the wrapper chain.
        $featureorder = [];
        if (isset($opts['feature']) && is_array($opts['feature']) && array_is_list($opts['feature'])) {
            $fmap = [];
            foreach ($opts['feature'] as $entry) {
                if (!is_array($entry)) {
                    continue;
                }
                $name = $entry['name'] ?? null;
                if ($name === null) {
                    continue;
                }
                $fopts = $entry;
                unset($fopts['name']);
                $fmap[$name] = $fopts;
                $featureorder[] = $name;
            }
            $opts['feature'] = $fmap;
        }

        $config = $ctx->config ?? [];
        $cfgopts = isset($config['options']) && is_array($config['options']) ? $config['options'] : [];

        $optspec = [
            'apikey' => '',
            'secret' => '',
            'base' => 'http://localhost:8000',
            'prefix' => '',
            'suffix' => '',
            'auth' => ['prefix' => '', 'basic' => false],
            'headers' => ['`$CHILD`' => '`$STRING`'],
            'allow' => [
                'method' => 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
                'op' => 'create,update,load,list,remove,command,direct,graphql',
            ],
            'entity' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false, 'alias' => (object)[]]],
            'feature' => ['`$CHILD`' => ['`$OPEN`' => true, 'active' => false]],
            'utility' => (object)[],
            'system' => (object)[],
            'test' => ['active' => false, 'entity' => ['`$OPEN`' => true]],
            'clean' => ['keys' => 'key,token,id'],
            // Server-variable values for a templated base URL (OpenAPI server
            // variables): {name} placeholders in 'base' are substituted from
            // this map at construction. Spec defaults arrive via the generated
            // config; user values override them.
            'server' => ['`$CHILD`' => ''],
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

        // Reattach the station binding handle held aside above (the feature
        // optspec is `$OPEN`, so the extra keys are legal; they were only
        // kept out of the clone/validate round-trip).
        if (null !== $station_handle || $station_has_caller) {
            if (!is_array($opts['feature'] ?? null)) {
                $opts['feature'] = [];
            }
            if (!is_array($opts['feature']['station'] ?? null)) {
                $opts['feature']['station'] = [];
            }
            if (null !== $station_handle) {
                $opts['feature']['station']['station'] = $station_handle;
            }
            if ($station_has_caller) {
                $opts['feature']['station']['calleropts'] = $station_caller;
            }
        }

        // Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
        // Every placeholder must resolve to a non-empty value: from
        // $options['server'] (user), else the config default. A placeholder
        // that resolves to '' is a construction ERROR in live mode — the URL
        // cannot work — but in test mode substitutes the deterministic value
        // "test-<name>" so offline tests need no configuration.
        $base = $opts['base'] ?? null;
        if (is_string($base) && strpos($base, '{') !== false) {
            $testmode =
                \Voxgig\Struct\Struct::getpath($opts, 'test.active') === true
                || \Voxgig\Struct\Struct::getpath($opts, 'feature.test.active') === true;
            $server = is_array($opts['server'] ?? null) ? $opts['server'] : [];
            $sdkname = \Voxgig\Struct\Struct::getpath($config, 'main.name');
            if (!is_string($sdkname) || $sdkname === '') {
                $sdkname = 'SDK';
            }
            $opts['base'] = preg_replace_callback(
                '/\{([A-Za-z0-9_]+)\}/',
                function ($m) use ($server, $testmode, $sdkname, $base) {
                    $name = $m[1];
                    $val = $server[$name] ?? '';
                    if (!is_string($val)) {
                        $val = '';
                    }
                    if ($val === '') {
                        if ($testmode) {
                            return 'test-' . $name;
                        }
                        throw new \InvalidArgumentException(
                            $sdkname . ": the server variable '" . $name . "' is required: " .
                            "the API base URL is '" . $base . "' — pass " .
                            "['server' => ['" . $name . "' => '...']] in the SDK options");
                    }
                    return $val;
                },
                $base
            );
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

        // Resolve the feature add-order: an explicit list order (above) wins;
        // otherwise order the map test-first, then the remaining names sorted,
        // so the outcome is deterministic and `test` is always the base.
        if (count($featureorder) === 0) {
            $fmap = $opts['feature'] ?? null;
            $names = is_array($fmap)
                ? array_values(array_filter(array_keys($fmap), 'is_string'))
                : [];
            sort($names, SORT_STRING);
            if (in_array('test', $names, true)) {
                $rest = array_values(array_filter($names, function ($n) {
                    return $n !== 'test';
                }));
                $featureorder = array_merge(['test'], $rest);
            } else {
                $featureorder = $names;
            }
            // Station special case, mirroring test's: its transport wrap must
            // sit immediately outside the base transport (inside retry/cache/
            // netsim), so map-form activation hoists it to just after test -
            // or first, when no test entry exists. Without this the sorted
            // default would init station last and wrap OUTSIDE the recording
            // features, turning its wire-truth events into fiction.
            $si = array_search('station', $featureorder, true);
            if (false !== $si) {
                array_splice($featureorder, $si, 1);
                $ti = array_search('test', $featureorder, true);
                array_splice($featureorder, false === $ti ? 0 : $ti + 1, 0, ['station']);
            }
        }

        $derived = ['clean' => $keyre === '' ? [] : ['keyre' => $keyre]];
        $derived['featureorder'] = $featureorder;
        $opts['__derived__'] = $derived;

        return $opts;
    }
}
