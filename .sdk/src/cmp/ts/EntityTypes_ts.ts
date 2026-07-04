

// Typed-model generator (TypeScript reference target).
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, src/<Sdk>Types.ts,
// with a TS `interface <Name>` per active entity plus a request/match type per
// active op. Field/param sentinels ($STRING, $INTEGER, ...) are turned into
// real TS types by the shared sdkgen helper `canonToType` (source of truth:
// @voxgig/apidef VALID_CANON).
//
// PORT RECIPE (language X): copy this file to EntityTypes_<X>.ts, keep the SAME
// type-name scheme (<Name>, <Name>LoadMatch, <Name>ListMatch, <Name>CreateData,
// <Name>UpdateData, <Name>RemoveMatch), swap the interface syntax for X's
// struct/class/dataclass syntax, pass 'X' to canonToType, wire it into
// Main_<X>.ts next to EntityBase, and reference the same type names from the
// <X> op fragments + entity accessor.

import {
  cmp, each,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'ts'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


// A valid TS property key, or a quoted string literal for anything else.
function propKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated type name for an op's request payload, e.g. AdviceLoadMatch.
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


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  File({ name: model.const.Name + 'Types.' + LANG }, () => {

    Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one property per field, `req:false` -> optional.
      Content(`export interface ${Name} {
`)
      fields.forEach((f: any) => {
        const opt = false === f.req ? '?' : ''
        Content(`  ${propKey(f.name)}${opt}: ${canonToType(f.type, LANG)}
`)
      })
      Content(`}

`)

      // Per active op: a request/match type. With params -> a typed interface;
      // without params -> an alias to a partial of the entity (a field filter).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        if (0 < params.length) {
          Content(`export interface ${typeName} {
`)
          params.forEach((p: any) => {
            const opt = false === p.reqd ? '?' : ''
            Content(`  ${propKey(p.name)}${opt}: ${canonToType(p.type, LANG)}
`)
          })
          Content(`}

`)
        }
        else {
          Content(`export type ${typeName} = Partial<${Name}>

`)
        }
      })
    })
  })
})


export {
  EntityTypes,
}
