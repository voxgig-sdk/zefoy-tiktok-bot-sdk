

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
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'ts'


// A valid TS property key, or a quoted string literal for anything else.
function propKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.
  entityList.forEach((e: any) => { if (null == e.Name) names(e, e.name) })

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

      // Per active op: a request/match type. The members and each member's
      // required/optional decision come from the shared partiality policy
      // (opRequestShape); this file only renders them as a TS interface.
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        Content(`export interface ${typeName} {
`)
        items.forEach((it: any) => {
          const opt = it.optional ? '?' : ''
          Content(`  ${propKey(it.name)}${opt}: ${canonToType(it.type, LANG)}
`)
        })
        Content(`}

`)
      })
    })
  })
})


export {
  EntityTypes,
}
