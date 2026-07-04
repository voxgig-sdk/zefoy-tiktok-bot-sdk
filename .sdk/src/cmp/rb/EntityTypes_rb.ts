

// Typed-model generator (Ruby target).
//
// Ported from the TypeScript reference EntityTypes_ts.ts. Reads
// main.<KIT>.entity.<e>.fields[] and per-op params (op.<name>.points[].args.params[])
// and emits one file, <Sdk>_types.rb, containing a keyword-init Struct per active
// entity plus a request/match Struct per active op. Ruby has no enforced static
// types, so each member carries a YARD `@!attribute`/`@return` annotation whose
// element type comes from the canonical sentinels via the shared sdkgen helper
// `canonToType` (source of truth: @voxgig/apidef VALID_CANON):
//   $STRING -> String, $INTEGER -> Integer, $NUMBER -> Float, $BOOLEAN -> Boolean,
//   $OBJECT -> Hash, $ARRAY -> Array, unknown -> Object.
//
// Type-name scheme (IDENTICAL to TS): data type = <Name>; per-op request
// <Name>LoadMatch / <Name>ListMatch / <Name>RemoveMatch (query/id ops),
// <Name>CreateData / <Name>UpdateData (body ops). An op WITH params -> a Struct of
// those params (reqd:false -> annotated `[Type, nil]`). An op WITHOUT params -> a
// Struct over the entity fields (Struct members are always optional/nil, so this is
// the Ruby stand-in for TS `Partial<Name>`; callers may equally pass a plain Hash).
//
// Struct.new(keyword_init: true) gives value objects usable as `Advice.new(id: ...)`.
// The file is required by the main SDK module so these constants are always loaded.

import {
  cmp, each,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'rb'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated type name for an op's request payload, e.g. ActivityLoadMatch.
function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


// A Ruby symbol literal for a member name: bare for identifiers, quoted otherwise.
function symName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*[?!=]?$/.test(name) ? ':' + name : ':"' + name + '"'
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


// Emit one typed value class: a YARD @!attribute block plus a keyword-init
// Struct. Ruby's `Struct.new` rejects zero members, so an empty shape falls
// back to a plain empty class (keeps the type name available).
function emitStruct(
  typeName: string,
  doc: string,
  members: Array<{ name: string, type: unknown, optional: boolean }>,
) {
  let block = `# ${doc}\n`

  members.forEach((m) => {
    const t = canonToType(m.type, LANG)
    const ret = m.optional ? `[${t}, nil]` : `[${t}]`
    block += `#\n# @!attribute [rw] ${m.name}\n#   @return ${ret}\n`
  })

  if (0 === members.length) {
    block += `class ${typeName}\nend\n\n`
    Content(block)
    return
  }

  block += `${typeName} = Struct.new(\n`
  members.forEach((m) => {
    block += `  ${symName(m.name)},\n`
  })
  block += `  keyword_init: true\n)\n\n`

  Content(block)
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  File({ name: model.const.Name + '_types.' + LANG }, () => {

    Content(`# frozen_string_literal: true

# Typed models for the ${model.const.Name} SDK.
#
# GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
# params (op.<name>.points[].args.params[]). Member types come from the
# canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
# @voxgig/apidef VALID_CANON). Ruby types are unenforced; these YARD
# annotations document the shapes. Do not edit by hand.

`)

    entityList.forEach((ent: any) => {
      const Name = ent.Name
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one member per field (`req:false` -> nilable).
      emitStruct(
        Name,
        `${Name} entity data model.`,
        fields.map((f: any) => ({ name: f.name, type: f.type, optional: false === f.req })),
      )

      // Per active op: a request/match Struct. With params -> a Struct of those
      // params; without params -> a Struct over the entity fields (all nilable,
      // the Ruby stand-in for TS Partial<${Name}>).
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        const op = ops[opname]
        if (null == op) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const params = opParams(op)

        if (0 < params.length) {
          emitStruct(
            typeName,
            `Request payload for ${Name}#${opname}.`,
            params.map((p: any) => ({ name: p.name, type: p.type, optional: false === p.reqd })),
          )
        }
        else {
          emitStruct(
            typeName,
            `Match filter for ${Name}#${opname} (any subset of ${Name} fields).`,
            fields.map((f: any) => ({ name: f.name, type: f.type, optional: true })),
          )
        }
      })
    })
  })
})


export {
  EntityTypes,
}
