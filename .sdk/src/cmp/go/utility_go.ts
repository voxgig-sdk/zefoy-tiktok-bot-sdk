
import * as Path from 'node:path'


import {
  camelify,
  canonKey,
  each,
  safeVarName,
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


// A type-correct Go example literal for a named match/data parameter of an
// op, derived entirely from the model. INTEGER/NUMBER render as the bare
// number `1`, BOOLEAN as `true`, ARRAY as the empty `[]any{}` and OBJECT as
// the empty `map[string]any{}`, everything else (STRING, unknown, missing)
// as the quoted `placeholder`.
function exampleValue(entity: any, op: any, paramName: string, placeholder: string): string {
  const key = canonKey(paramCanonType(entity, op, paramName))
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
  return `"${placeholder}"`
}


// A camelCase Go identifier for a snake_case model name
// (`status_embed_config` -> `statusEmbedConfig`) — Go variables are
// camelCase, never snake_case — with the reserved-word guard applied (a
// `type`/`range` entity must not bind a Go keyword).
function goVarName(name: string): string {
  const pascal = camelify(name)
  return safeVarName(pascal.charAt(0).toLowerCase() + pascal.slice(1), 'go')
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


function clean(o: any) {
  return walk(clone(o), (k: any, v: any, p: any) => {
    if (null != k && k.endsWith('$')) {
      delete p[k]
    }
    return v
  })
}


export {
  clean,
  exampleValue,
  formatGoMap,
  formatGoValue,
  goVarName,
  projectPath,
}
