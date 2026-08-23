
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  configDefinition,
  configReprSetting,
  each,
  isAuthActive,
  isConfigData,
  rawStringLiteral,
  resolveAuthPrefix,
  serverVariables,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  formatPhpArray,
} from './utility_php'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see MakeOptions).
  // `$` is escaped so a default can never open a PHP interpolation.
  const svars = serverVariables(model)
  const phps = (s: string) => JSON.stringify(s).replace(/\$/g, '\\$')
  const serverBlock = 0 === svars.length ? '' :
    '                "server" => [\n' +
    svars.map((v: any) => `                    ${phps(v.name)} => ${phps(v.dflt)},\n`).join('') +
    '                ],\n'

  const authBlock = authActive
    ? `                "auth" => [
                    "prefix" => "${authPrefix}",
                ],\n`
    : ''

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not. Passing the
  // target name opts in to the main.slug/version/target identity fields -
  // both representations below carry them, keeping the reps interchangeable.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'config.' + target.ext }, () => {

    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK configuration

class ${model.const.Name}Config
{
    /** @var array<string,mixed>|null */
    private static ?array $shared_config = null;

    /**
     * Return the process-wide config, built once on first use. The SDK reads
     * the config on every request and never writes to it, so one instance is
     * shared by every client rather than rebuilt per client.
     *
     * PHP arrays are copy-on-write, so callers that do mutate the result get
     * their own copy and cannot disturb the shared one.
     */
    public static function shared_config(): array
    {
        if (self::$shared_config === null) {
            self::$shared_config = self::make_config();
        }
        return self::$shared_config;
    }

`)

    // ABOVE THE THRESHOLD: emit the model as DATA.
    //
    // An array literal is compiled opcode by opcode and held in the opcache
    // entry for this file; a string constant is one token, and `json_decode`
    // (C) builds the array far faster than the equivalent literal.
    //
    // PHP cannot tell an empty list from an empty map, so `{}` and `[]` decode
    // to the same value and the two representations have to AGREE about which
    // one the literal would have produced. `formatPhpArray` emits `[]` for
    // every empty map, and the literal branch hand-writes `(object)[]` in
    // exactly two places - `entity` and `options.entity`, and only when the
    // model declares no entities at all, because the SDK runtime validator
    // wants a map there. This reproduces that rule rather than improving on
    // it: an emission wart is not something the data path gets to fix
    // unilaterally, or the two branches stop being interchangeable.
    //
    // A SINGLE-quoted literal, so the JSON survives verbatim: a double-quoted
    // PHP string would interpolate any `$name` the model contains - and the
    // model is full of them (`$STRING`, `$action`).
    if (asData) {
      Content(`    /**
     * THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
     *
     * Emitted only above a size threshold, or when \`main.kit.config.repr\`
     * pins it: for a small model the array literal is smaller and far easier
     * to read when debugging.
     */
    private const CONFIG_DATA = ${rawStringLiteral(configJson)};

    /**
     * Decoded JSON in the shape the literal branch produces: every map
     * becomes an array, including an empty one.
     */
    private static function config_decode(mixed $v): mixed
    {
        if ($v instanceof \\stdClass) {
            $out = [];
            foreach (get_object_vars($v) as $k => $c) {
                $out[$k] = self::config_decode($c);
            }
            return $out;
        }
        if (is_array($v)) {
            return array_map([self::class, 'config_decode'], $v);
        }
        return $v;
    }

    /**
     * Parse a fresh, fully materialised config array. Every call re-parses,
     * so prefer shared_config unless you need a private copy.
     */
    public static function make_config(): array
    {
        /** @var array<string,mixed> $out */
        $out = self::config_decode(json_decode(self::CONFIG_DATA));

        // The two map-shape exceptions the literal branch makes by hand.
        if (count($out["entity"]) === 0) {
            $out["entity"] = (object)[];
        }
        if (count($out["options"]["entity"]) === 0) {
            $out["options"]["entity"] = (object)[];
        }
        return $out;
    }
`)
    }
    else {

    // Identity beyond the camel Name: values from configDefinition's def, not
    // re-derived here, so the literal rep and the data rep cannot disagree on
    // identity (the slug is CARRIED, never derived from the camel name -
    // station's descriptor reads all three; mirrors cmp/ts's #MainMeta).
    Content(`    /**
     * Build a fresh, fully materialised config array. Every call rebuilds the
     * whole structure, so prefer shared_config unless you need a private copy.
     */
    public static function make_config(): array
    {
        return [
            "main" => [
                "name" => "${model.const.Name}",
                "slug" => ${phps(configDef.main.slug)},
                "version" => ${phps(configDef.main.version)},
                "target" => ${phps(configDef.main.target)},
            ],
            "feature" => [
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`                "${f.name}" => ${formatPhpArray(fconfig, 4)},
`)
    })

    // PHP can't distinguish empty list from empty map; the SDK runtime
    // validator wants an object for `entity` and `feature.test.entity`. Use
    // `(object)[]` when the map is empty so the merge preserves map shape.
    const entityIsEmpty = Object.keys(entity || {}).length === 0
    if (entityIsEmpty) {
      Content(`            ],
            "options" => [
                "base" => "${baseUrl}",
${serverBlock}${authBlock}                "headers" => ${formatPhpArray(headers, 4)},
                "entity" => (object)[],
            ],
            "entity" => (object)[],
        ];
`)
    } else {
    Content(`            ],
            "options" => [
                "base" => "${baseUrl}",
${serverBlock}${authBlock}                "headers" => ${formatPhpArray(headers, 4)},
                "entity" => [
`)

    each(entity, (entity: any) => {
      Content(`                    "${entity.name}" => [],
`)
    })

    Content(`                ],
            ],
            "entity" => ${formatPhpArray(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }, true), a), {}), 3)},
        ];
`)
    }

    Content(`    }
`)
    }

    Content(`

    public static function make_feature(string $name)
    {
        require_once __DIR__ . '/features.php';
        return ${model.const.Name}Features::make_feature($name);
    }
}
`)
  })
})


export {
  Config
}
