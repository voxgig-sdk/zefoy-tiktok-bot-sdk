
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
  formatJSONSrc,
  formatJson,
  projectPath,
  exampleValue,
}
