

// Typed-model generator (Python target). Port of EntityTypes_ts.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one module, <sdk>_types.py,
// with a `class <Name>(TypedDict):` per active entity plus a request/match type
// per active op. Field/param sentinels ($STRING, $INTEGER, ...) are turned into
// real Python types by the shared sdkgen helper `canonToType` (source of truth:
// @voxgig/apidef VALID_CANON).
//
// TYPE CHOICE: `TypedDict`, not `@dataclass`. The generated ops return/accept
// plain runtime dicts (data_get/match_get return `vs.clone(self._data)`; ops
// take/return dicts), so a `@dataclass` annotation is only aspirational — a
// strict checker at a call site would see dict-vs-dataclass. A TypedDict *is* a
// dict shape, so annotating these dict-returning/-accepting ops with TypedDict
// makes the TYPES MATCH the runtime. Runtime behaviour is unchanged.
//
// OPTIONAL FIELDS: a `req:false` field/param is a key that MAY be absent, which
// is exactly TypedDict `total=False` (key optionality), not `Optional[T]` (a
// None value). To express required AND optional keys on py>=3.8 WITHOUT a
// typing_extensions dependency (no `NotRequired`), a type with both splits into
// a required base `class <Name>Required(TypedDict): ...` and a `total=False`
// subclass `class <Name>(<Name>Required, total=False): ...` that carries the
// public name and adds the optional keys. Degenerate shapes collapse to a
// single class (all-required, all-optional, or empty). The all-optional
// collapse also serves the match-mirror types (the Python analogue of TS
// `Partial<${Name}>`).
//
// Keep the SAME type-name scheme as every other language: <Name>,
// <Name>LoadMatch, <Name>ListMatch, <Name>CreateData, <Name>UpdateData,
// <Name>RemoveMatch.

import {
  cmp, each,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'py'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


// Python keywords that cannot be used as class-syntax TypedDict field names.
const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])


// A name usable as a class-syntax TypedDict key (valid identifier, not a
// keyword). Non-identifier/keyword field names have no safe class-syntax
// rendering, so they are skipped (they remain reachable via the runtime dict).
function pyIdent(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !PY_KEYWORDS.has(name)
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated type name for an op's request payload, e.g. FactLoadMatch.
function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


// Collect an op's params, deduped by name across all of its points.
function opParams(op: any): any[] {
  const points = op && op.points ? each(op.points) : []
  const seen: Record<string, boolean> = {}
  const out: any[] = []
  points.forEach((pt: any) => {
    const params = pt && pt.args && pt.args.params ? each(pt.args.params) : []
    params.forEach((p: any) => {
      if (p && null != p.name && !seen[p.name]) {
        seen[p.name] = true
        out.push(p)
      }
    })
  })
  return out
}


// Emit a TypedDict named `typeName` from a list of {name, type} items. `reqKey`
// names the per-item required flag ('req' for fields, 'reqd' for params).
// Required items (flag !== false) become required keys; optional items
// (flag === false) become not-required keys via a `total=False` extension.
// `allOptional` forces every item optional (the match-mirror types).
//
// Shape selection (see file header for the rationale):
//   both required + optional -> `<typeName>Required` base + `total=False` sub
//   only required            -> single `class <typeName>(TypedDict):`
//   only optional            -> single `class <typeName>(TypedDict, total=False):`
//   no usable keys           -> single `class <typeName>(TypedDict): pass`
function emitTypedDict(
  typeName: string, items: any[], reqKey: string, allOptional: boolean
): void {
  const usable = items.filter((it: any) => it && null != it.name && pyIdent(it.name))

  const isOpt = (it: any) => allOptional || false === it[reqKey]
  const required = usable.filter((it: any) => !isOpt(it))
  const optional = usable.filter((it: any) => isOpt(it))

  const field = (it: any) => `    ${it.name}: ${canonToType(it.type, LANG)}
`

  if (0 === usable.length) {
    Content(`class ${typeName}(TypedDict):
    pass
`)
    return
  }

  if (0 === required.length) {
    Content(`class ${typeName}(TypedDict, total=False):
`)
    optional.forEach((it: any) => Content(field(it)))
    return
  }

  if (0 === optional.length) {
    Content(`class ${typeName}(TypedDict):
`)
    required.forEach((it: any) => Content(field(it)))
    return
  }

  Content(`class ${typeName}Required(TypedDict):
`)
  required.forEach((it: any) => Content(field(it)))
  Content(`

class ${typeName}(${typeName}Required, total=False):
`)
  optional.forEach((it: any) => Content(field(it)))
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$
  const target = props.target || {}
  const ext = target.ext || LANG

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  File({ name: model.const.Name.toLowerCase() + '_types.' + ext }, () => {

    Content(`# Typed models for the ${model.const.Name} SDK.
#
# GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Field/param types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Do not edit by hand.
#
# These are TypedDicts, not dataclasses: the SDK ops return/accept plain dicts
# at runtime, and a TypedDict IS a dict shape, so the types match the runtime.
# Optional (req:false) keys are modelled as TypedDict key-optionality
# (total=False), split into a required base + total=False subclass when a type
# has both required and optional keys.

from __future__ import annotations

from typing import TypedDict, Any
`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one key per field, `req:false` -> optional key.
      Content(`

`)
      emitTypedDict(Name, fields, 'req', false)

      // Per active op: a request/match type. With params -> a TypedDict of
      // those params; without params -> a TypedDict mirroring the entity fields
      // as all-optional keys (the Python analogue of TS `Partial<${Name}>`).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        Content(`

`)
        if (0 < params.length) {
          emitTypedDict(typeName, params, 'reqd', false)
        }
        else {
          emitTypedDict(typeName, fields, 'req', true)
        }
      })
    })
  })
})


export {
  EntityTypes,
}
