

// Typed-model generator (Python target). Port of EntityTypes_ts.ts.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one module, <sdk>_types.py,
// with a `@dataclass class <Name>:` per active entity plus a request/match type
// per active op. Field/param sentinels ($STRING, $INTEGER, ...) are turned into
// real Python types by the shared sdkgen helper `canonToType` (source of truth:
// @voxgig/apidef VALID_CANON).
//
// TYPE CHOICE: the entity data model is a `@dataclass` (the structured record a
// consumer conceptually gets back). The per-op request/match types are ALSO
// `@dataclass`es, for a single consistent construct across the module (see the
// port task notes: "@dataclass models"; "reqd:false -> Optional + default
// None"). `@dataclass` cleanly expresses required (no default) vs optional
// (`Optional[T] = None`) and is 3.8-compatible with no typing_extensions.
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


// Python keywords that cannot be used as @dataclass field names.
const PY_KEYWORDS = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break',
  'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'finally',
  'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal',
  'not', 'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
])


// A name usable as a @dataclass attribute (valid identifier, not a keyword).
// Non-identifier/keyword field names have no safe dataclass rendering, so they
// are skipped (they remain reachable via the runtime dict).
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


// Emit a @dataclass body from a list of {name, type} items. `reqKey` names the
// per-item required flag ('req' for fields, 'reqd' for params). Required items
// (flag !== false) come first with no default; optional items (flag === false)
// follow as `Optional[T] = None`. Ordering required-before-optional satisfies
// Python's "no non-default field after a default field" rule while keeping the
// alphabetical (each()-sorted) order within each group deterministic.
// `allOptional` forces every item optional (used for the match-mirror types).
function classBody(
  items: any[], reqKey: string, allOptional: boolean
): void {
  const usable = items.filter((it: any) => it && null != it.name && pyIdent(it.name))

  if (0 === usable.length) {
    Content(`    pass
`)
    return
  }

  const isOpt = (it: any) => allOptional || false === it[reqKey]

  const required = usable.filter((it: any) => !isOpt(it))
  const optional = usable.filter((it: any) => isOpt(it))

  required.forEach((it: any) => {
    Content(`    ${it.name}: ${canonToType(it.type, LANG)}
`)
  })
  optional.forEach((it: any) => {
    Content(`    ${it.name}: Optional[${canonToType(it.type, LANG)}] = None
`)
  })
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

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Any

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one attribute per field, `req:false` -> Optional.
      Content(`
@dataclass
class ${Name}:
`)
      classBody(fields, 'req', false)

      // Per active op: a request/match type. With params -> a @dataclass of
      // those params; without params -> a @dataclass mirroring the entity
      // fields as all-Optional (the Python analogue of TS `Partial<${Name}>`).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        Content(`

@dataclass
class ${typeName}:
`)
        if (0 < params.length) {
          classBody(params, 'reqd', false)
        }
        else {
          classBody(fields, 'req', true)
        }
      })

      Content(`
`)
    })
  })
})


export {
  EntityTypes,
}
