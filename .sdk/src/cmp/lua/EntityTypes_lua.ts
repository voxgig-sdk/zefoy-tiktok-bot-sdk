

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

import { canonToType, opTypeName, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'lua'


// A bare LuaLS field key, or a bracketed string literal for anything that is
// not a plain Lua identifier.
function propKey(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : '[' + JSON.stringify(name) + ']'
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

      // Per active op: a request/match class. Members and their optionality
      // come from the shared partiality policy (opRequestShape); this file only
      // renders them as LuaLS ---@field lines.
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        Content(`---@class ${typeName}
`)
        items.forEach((it: any) => {
          const opt = it.optional ? '?' : ''
          Content(`---@field ${propKey(it.name)}${opt} ${canonToType(it.type, LANG)}
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
