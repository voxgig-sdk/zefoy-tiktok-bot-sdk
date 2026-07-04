

// Typed-model generator (Lua target).
//
// Lua is dynamically typed, so the "types" are LuaLS annotations
// (---@class / ---@field) for editor/tooling DX only — no runtime effect.
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, <sdk>_types.lua,
// with a `---@class <Name>` per active entity plus a request/match ---@class
// per active op. Field/param sentinels ($STRING, $INTEGER, ...) are turned
// into LuaLS types by the shared sdkgen helper `canonToType` ('lua' column).
//
// Keeps the SAME type-name scheme as the TS reference (<Name>,
// <Name>LoadMatch, <Name>ListMatch, <Name>CreateData, <Name>UpdateData,
// <Name>RemoveMatch). The op fragments reference these class names via
// ---@param / ---@return.

import {
  cmp, each,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'lua'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


// A bare LuaLS field key, or a bracketed string literal for anything that is
// not a plain Lua identifier.
function propKey(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : '[' + JSON.stringify(name) + ']'
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated class name for an op's request payload, e.g. AdviceLoadMatch.
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
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  File({ name: model.name + '_types.' + (target.ext || LANG) }, () => {

    Content(`-- Typed models for the ${model.const.Name} SDK (LuaLS annotations).
--
-- GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
-- params (op.<name>.points[].args.params[]). Field/param types come from the
-- canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
-- @voxgig/apidef VALID_CANON). Annotations only — no runtime effect. Do not
-- edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one ---@field per field, `req:false` -> optional (?).
      Content(`---@class ${Name}
`)
      fields.forEach((f: any) => {
        const opt = false === f.req ? '?' : ''
        Content(`---@field ${propKey(f.name)}${opt} ${canonToType(f.type, LANG)}
`)
      })
      Content(`
`)

      // Per active op: a request/match class. With params -> typed fields;
      // without params -> an empty class (a field filter over the entity).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        Content(`---@class ${typeName}
`)
        params.forEach((p: any) => {
          const opt = false === p.reqd ? '?' : ''
          Content(`---@field ${propKey(p.name)}${opt} ${canonToType(p.type, LANG)}
`)
        })
        Content(`
`)
      })
    })

    // Make the file a require-able (empty) module. The blank line above keeps
    // LuaLS from binding the last ---@class to this local.
    Content(`local M = {}

return M
`)
  })
})


export {
  EntityTypes,
}
