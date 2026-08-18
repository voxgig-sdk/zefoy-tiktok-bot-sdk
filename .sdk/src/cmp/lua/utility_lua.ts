
import * as Path from 'node:path'

import {
  clone,
  walk,
} from '@voxgig/struct'


function projectPath(suffix?: string): string {
  return Path.normalize(Path.join(__dirname, '../../..', suffix ?? ''))
}


function formatLuaTable(obj: any, indent: number = 0): string {
  if (obj == null) {
    return 'nil'
  }

  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '{}'
    }
    const items = obj.map(v => padInner + formatLuaValue(v, indent + 1)).join(',\n')
    return `{\n${items},\n${pad}}`
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) {
      return '{}'
    }
    const items = entries
      .map(([k, v]) => `${padInner}["${k}"] = ${formatLuaValue(v, indent + 1)}`)
      .join(',\n')
    return `{\n${items},\n${pad}}`
  }

  return formatLuaValue(obj, indent)
}


function formatLuaValue(val: any, indent: number = 0): string {
  if (val === null || val === undefined) {
    return 'nil'
  }
  if (typeof val === 'string') {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  if (typeof val === 'number') {
    return String(val)
  }
  if (typeof val === 'boolean') {
    return val ? 'true' : 'false'
  }
  if (Array.isArray(val)) {
    return formatLuaTable(val, indent)
  }
  if (typeof val === 'object') {
    return formatLuaTable(val, indent)
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



// A Lua LONG-BRACKET string holding `s` verbatim.
//
// Lua's quoted strings process escapes, so the JSON's own `\n` and `\uXXXX`
// would be consumed by the Lua lexer before the JSON decoder ever saw them -
// turning an escaped newline into a real one inside a JSON string (invalid
// JSON), and failing outright on `\uXXXX`, which Lua 5.1/5.2 do not accept at
// all. A long bracket processes nothing, so the JSON text survives byte for
// byte. The level is raised until its terminator does not occur in the text.
function luaLongString(s: string): string {
  let level = 0
  while (s.includes(']' + '='.repeat(level) + ']')) {
    level++
  }
  const eq = '='.repeat(level)
  // A long bracket swallows an immediately following newline, so start the
  // content on the same line as the opener.
  return '[' + eq + '[' + s + ']' + eq + ']'
}

export {
  luaLongString,
  clean,
  formatLuaTable,
  formatLuaValue,
  projectPath,
}
