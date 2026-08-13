

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
// Type-name scheme (as TS, with one Ruby-only guard): data type = <Name>,
// except where Ruby core already owns that constant — `File`, `Time`, `Data`,
// … — which would be silently REPLACED by the assignment; those become
// <Name>Type (see rbSafeTypeName). Per-op request
// <Name>LoadMatch / <Name>ListMatch / <Name>RemoveMatch (query/id ops),
// <Name>CreateData / <Name>UpdateData (body ops). An op WITH params -> a Struct of
// those params (reqd:false -> annotated `[Type, nil]`). An op WITHOUT params -> a
// Struct over the entity fields (Struct members are always optional/nil, so this is
// the Ruby stand-in for TS `Partial<Name>`; callers may equally pass a plain Hash).
//
// Struct.new(keyword_init: true) gives value objects usable as `Advice.new(id: ...)`.
// The file is required by the main SDK module so these constants are always loaded.

import {
  cmp, each, names,
  File, Content,
} from '@voxgig/sdkgen'

import { canonToType, opTypeName, opRequestShape, warnEntityTypeCollisions , deriveEntityNames, rbSafeTypeName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'rb'


// A Ruby symbol literal for a member name: bare for identifiers, quoted otherwise.
function symName(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*[?!=]?$/.test(name) ? ':' + name : ':"' + name + '"'
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
  const { model, log } = props.ctx$

  // only_active:false — getModelPath DROPS active:false entries by default,
  // but the consumer scaffold (create-sdkgen Root.ts) iterates the RAW entity
  // collection, so inactive entities still get generated entity code that
  // references these typed names. The typed model must cover them too.
  const entity = getModelPath(model, `main.${KIT}.entity`, { only_active: false, required: false })
  // Emit for EVERY entity that gets generated entity code: the consumer
  // scaffold (create-sdkgen Root.ts) iterates entities WITHOUT an active
  // filter, so inactive entities still get class files referencing these
  // typed names. Filter on `name` (always present), NOT `active` — parity
  // with the go emitter's fix.
  const entityList = deriveEntityNames(entity)
  // Derive the PascalCase Name up-front — it is set LAZILY by names(), so an
  // entity not yet named (e.g. a fieldless placeholder) would otherwise read
  // `Name = undefined` below. Parity with the go emitter's fix.

  // Surface duplicate generated type names (two entities with the same
  // PascalCase Name) — they would redeclare a type in statically-typed
  // targets. Detection only; renaming is a model-level decision.
  warnEntityTypeCollisions(entity, log, LANG)

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
      // Ruby constants share ONE namespace with the core classes, and
      // assigning one silently replaces it — an entity named `File` emitting
      // `File = Struct.new(...)` clobbers ::File and every later `File.join`
      // raises NoMethodError. Only the bare data-type constant needs the
      // guard; the per-op names below always carry a suffix that no core
      // constant matches. The `client.File(...)` accessor is a METHOD, a
      // separate namespace, so the public surface is unchanged.
      const TypeName = rbSafeTypeName(Name)
      const fields = (ent.fields ? each(ent.fields) : [])
        .filter((f: any) => f.active !== false)

      // Entity data model: one member per field (`req:false` -> nilable).
      emitStruct(
        TypeName,
        `${Name} entity data model.`,
        fields.map((f: any) => ({ name: f.name, type: f.type, optional: false === f.req })),
      )

      // Per active op: a request/match Struct. Members and their optionality
      // come from the shared partiality policy (opRequestShape); this file only
      // renders them as a keyword-init Struct.
      const ops = ent.op || {}
      ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
        if (null == ops[opname]) {
          return
        }

        const typeName = opTypeName(Name, opname)
        const { items } = opRequestShape(ent, opname)

        emitStruct(
          typeName,
          `Request payload for ${Name}#${opname}.`,
          items,
        )
      })
    })
  })
})


export {
  EntityTypes,
}
