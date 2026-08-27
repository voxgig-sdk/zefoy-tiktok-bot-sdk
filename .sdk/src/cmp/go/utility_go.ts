
import * as Path from 'node:path'


import {
  camelify,
  canonKey,
  canonScalarKey,
  each,
  opParams,
  exampleVarName,
  names,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


// --- Model-driven example literals -----------------------------------------
// Doc snippets must use example values whose TYPE matches the model's
// declared param/field type — a number id shown as a quoted string documents
// a call the API would reject. These helpers derive the example literal from
// the SAME model source the request shapes are built from (opRequestShape),
// so the docs and the model can never disagree. Go twin of the ts
// exampleValue (cmp/ts/utility_ts.ts), rendering Go literals.

// The declared canon-type sentinel of a named parameter of an op — looked up
// in the op's `points[].args.params[]` exactly as the typed-model generator
// does. Falls back to the entity field of the same name (used when the op
// has no params and the request shape mirrors the entity fields). Returns
// undefined when neither is present.
function paramCanonType(entity: any, op: any, paramName: string): unknown {
  // opParams, NOT a raw walk of op.points.
  //
  // opParams drops points flagged with select['$action'] and merges what is
  // left; the typed-model generator reaches the op's params through it, so
  // anything else is a DIFFERENT set of params wearing the same name.
  //
  // A raw walk returned the first match on ANY point, action points included.
  // github's `action` entity has a field `owner` (`$OBJECT`, "A GitHub user")
  // and seven create points whose path carries `{owner}` (a string) — so the
  // type said Record<string, any> and the doc example said 'example_owner',
  // and ts/README.md stopped compiling. Same for workflow_id: `number` in the
  // type, quoted string in the example.
  //
  // Deriving from opParams is what actually makes good on the promise below —
  // that the docs and the generated types cannot disagree.
  const params = op ? each(opParams(op)) : []
  const found = (params as any[]).find((p: any) => p && p.name === paramName)
  if (found) {
    return found.type
  }
  const field = (entity && entity.fields ? each(entity.fields) : [])
    .find((f: any) => f && f.name === paramName) as any
  return field && field.type
}


// A type-correct Go example literal for a named match/data parameter of an
// op, derived entirely from the model. INTEGER/NUMBER render as the bare
// number `1`, BOOLEAN as `true`, ARRAY as the empty `[]any{}` and OBJECT as
// the empty `map[string]any{}`, everything else (STRING, unknown, missing)
// as the quoted `placeholder`.
function exampleValue(entity: any, op: any, paramName: string, placeholder: string): string {
  // canonScalarKey, not canonKey: a nullable field's sentinel is the union
  // ['`$ONE`', ['`$NUMBER`','`$NULL`']], which canonKey stringifies into
  // nothing recognizable — so a `number | null` id fell through to the
  // quoted placeholder and the example failed to compile against the type
  // generated from that very sentinel.
  const key = canonScalarKey(paramCanonType(entity, op, paramName))
  if ('INTEGER' === key || 'NUMBER' === key) {
    return '1'
  }
  if ('BOOLEAN' === key) {
    return 'true'
  }
  if ('ARRAY' === key) {
    return '[]any{}'
  }
  if ('OBJECT' === key) {
    return 'map[string]any{}'
  }
  if ('NULL' === key) {
    return 'nil'
  }
  return `"${placeholder}"`
}


// A camelCase Go identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`) — Go variables are
// camelCase, never snake_case — with the reserved-word guard applied (a
// `type`/`range` entity must not bind a Go keyword).
function goVarName(name: string): string {
  const pascal = camelify(name)
  // exampleVarName also guards `client`, the doc examples' SDK-instance var.
  return exampleVarName(pascal.charAt(0).toLowerCase() + pascal.slice(1), 'go')
}


function formatGoMap(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'nil'
  }

  const pad = '\t'.repeat(indent)
  const padInner = '\t'.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]any{}'
    }
    const items = obj.map(v => padInner + formatGoValue(v, indent + 1)).join(',\n')
    return `[]any{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return 'map[string]any{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}"${k}": ${formatGoValue(v, indent + 1)}`)
      .join(',\n')
    return `map[string]any{\n${items},\n${pad}}`
  }

  return formatGoValue(obj, indent)
}


function formatGoValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return String(val)
    }
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatGoMap(val, indent)
  }
  if (typeof val === 'object') {
    return formatGoMap(val, indent)
  }
  return String(val)
}


// Emission-time normalisation of a model subtree (L0).
//
// Always drops jostraca's iteration metadata (`$`-suffixed keys: index$,
// key$, val$). With `dropDefaults`, also drops keys whose value IS the
// default the runtime already assumes when the key is absent, which is pure
// payload — see CONFIG_DEFAULT.
//
// Rebuilds the tree rather than mutating during a walk. The previous
// implementation walked a clone calling `delete p[k]`, but walk() assigns its
// callback's result back over the child (`setprop(out, ckey, walk(...))`), so
// the delete was undone on the way out and the helper silently did nothing.
// Returning `undefined` from the callback does not fix it either: setprop
// stores undefined rather than removing the key, which then emits as a null.
//
// `dropDefaults` is opt-in and must be passed ONLY for the entity subtree.
// `active` means something different in feature config, where absent reads as
// INACTIVE (see feature_init) — dropping `active: true` there would silently
// disable the feature.
// jostraca's iteration metadata, injected by each()/names() while it walks the
// model. Listed explicitly rather than matched by trailing-dollar suffix: a
// trailing dollar is not exclusive to jostraca -- Seneca uses entity$ as real
// data -- so a blanket suffix match can silently drop a legitimate API field.
const MODEL_META = ['index$', 'key$', 'val$']

// Keys whose value IS the default the runtime already assumes when the key is
// absent, so emitting them is pure payload.
const CONFIG_DEFAULT: Record<string, any> = {
  active: true,
  req: false,
  reqd: false,
}

// Subtrees carrying user payload rather than schema. An active:true inside an
// OpenAPI example is DATA, not a default, so default-pruning stops at these
// keys and everything below them is passed through untouched.
const PAYLOAD_KEYS = ['default', 'example', 'examples']

function clean(o: any, dropDefaults?: boolean): any {
  const prune = (node: any, defaults: boolean): any => {
    if (Array.isArray(node)) {
      return node.map((n: any) => prune(n, defaults))
    }
    if (null != node && 'object' === typeof node) {
      const out: any = {}
      for (const k of Object.keys(node)) {
        if (MODEL_META.includes(k)) {
          continue
        }
        if (defaults && k in CONFIG_DEFAULT && CONFIG_DEFAULT[k] === node[k]) {
          continue
        }
        out[k] = prune(node[k], defaults && !PAYLOAD_KEYS.includes(k))
      }
      return out
    }
    return node
  }
  return prune(o, true === dropDefaults)
}



// The Go identifier fragment for a feature's generated constructor
// (New<Fname>Feature / New<Fname>FeatureFunc).
//
// SHARED because the identifier is DECLARED in Main_go.ts (registry.go and the
// root init()) and REFERENCED in Config_go.ts (makeFeature). Two copies of the
// derivation is a latent undefined-identifier bug in the generated SDK: they
// were both `name.charAt(0).toUpperCase() + name.slice(1)`, consistently wrong
// for a name needing real normalisation but at least agreeing, until one side
// was fixed alone and `rate_limit` became NewRateLimitFeatureFunc in the
// registry and NewRate_limitFeatureFunc in config.
//
// Uses the jostraca-derived PascalCase `Name` (deriving it if absent), which is
// what Main_ts.ts uses, so a hyphenated or underscored feature name yields a
// legal Go identifier instead of `NewRate-limitFeatureFunc`.
function goFeatureName(feat: any): string {
  if (null == feat.Name) {
    names(feat, feat.name)
  }
  return feat.Name
}


export {
  goFeatureName,
  clean,
  exampleValue,
  formatGoMap,
  formatGoValue,
  goVarName,
  projectPath,
}
