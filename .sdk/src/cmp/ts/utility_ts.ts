
import * as Path from 'node:path'


import {
  canonKey,
  each,
} from '@voxgig/sdkgen'

import {
  clone,
  walk,
} from '@voxgig/struct'


// --- Model-driven example literals -----------------------------------------
// Doc snippets must use example values whose TYPE matches the generated
// TypeScript types, or the snippet does not compile. The id/match params of
// load/remove/update are the common trap: their generated
// `<Name><Op>Match` / `<Name><Op>Data` type is built from the op's params
// (see EntityTypes_ts.ts), so a `number` id shown as a quoted string is a
// TS2322 error. These helpers derive the example literal from the SAME model
// source, so the docs and the generated types can never disagree.

// The declared canon-type sentinel of a named parameter of an op — looked up
// in the op's `points[].args.params[]` exactly as the typed-model generator
// does. Falls back to the entity field of the same name (used when the op
// has no params and the generated match type is `Partial<Entity>`). Returns
// undefined when neither is present.
function paramCanonType(entity: any, op: any, paramName: string): unknown {
  const points = op && op.points ? each(op.points) : []
  for (const pt of points as any[]) {
    const params = pt && pt.args && pt.args.params ? each(pt.args.params) : []
    const found = (params as any[]).find((p: any) => p && p.name === paramName)
    if (found) {
      return found.type
    }
  }
  const field = (entity && entity.fields ? each(entity.fields) : [])
    .find((f: any) => f && f.name === paramName) as any
  return field && field.type
}


// A type-correct example literal for a named match/data parameter of an op,
// derived entirely from the model. INTEGER/NUMBER render as the bare number
// `1` (a quoted string on a `number` field is a compile error), BOOLEAN as
// `true`, ARRAY as the empty `[]` and OBJECT as the empty `{}` (a quoted
// string is not assignable to `any[]` / `Record<string, any>`), everything
// else (STRING, unknown, missing) as the quoted `placeholder`.
function exampleValue(entity: any, op: any, paramName: string, placeholder: string): string {
  const key = canonKey(paramCanonType(entity, op, paramName))
  if ('INTEGER' === key || 'NUMBER' === key) {
    return '1'
  }
  if ('BOOLEAN' === key) {
    return 'true'
  }
  if ('ARRAY' === key) {
    return '[]'
  }
  if ('OBJECT' === key) {
    return '{}'
  }
  return `'${placeholder}'`
}


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatJSONSrc(jsonsrc: string) {
  return jsonsrc
    .replace(/([{:\[,])/g, '$1 ')
    .replace(/([}\]])/g, ' $1')
}


function formatJson(obj: any, flags?: { line?: boolean, margin?: number }): string {
  const marginSize = flags?.margin ?? 0
  const marginStr = ' '.repeat(marginSize)

  let json: string

  if (flags?.line) {
    // One line with spaces for clarity
    json = JSON.stringify(obj)
      .replace(/([{:\[,])/g, '$1 ')
      .replace(/([}\]])/g, ' $1')
  }
  else {
    // Pretty printed with 2-space indentation
    json = JSON.stringify(obj, null, 2)
  }

  // Add margin to the left of every line
  if (marginSize > 0) {
    json = json.split('\n').map(line => marginStr + line).join('\n')
  }

  return json
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


export {
  clean,
  formatJSONSrc,
  formatJson,
  projectPath,
  exampleValue,
}
