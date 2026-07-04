

// Typed-model generator (PHP target).
//
// Ported from the TypeScript reference EntityTypes_ts.ts. Reads
// main.<KIT>.entity.<e>.fields[] and per-op params (op.<name>.points[].args.params[])
// and emits one file, types/<Sdk>Types.php, containing a PHP 8 class with typed
// properties per active entity plus a request/match class per active op. Field/param
// sentinels ($STRING, $INTEGER, ...) are turned into real PHP types by the shared
// sdkgen helper `canonToType` (source of truth: @voxgig/apidef VALID_CANON):
//   $STRING -> string, $INTEGER -> int, $NUMBER -> float, $BOOLEAN -> bool,
//   $OBJECT/$ARRAY -> array, unknown -> mixed.
//
// Type-name scheme (IDENTICAL to TS): data type = <Name>; per-op request
// <Name>LoadMatch / <Name>ListMatch / <Name>RemoveMatch (query/id ops),
// <Name>CreateData / <Name>UpdateData (body ops). An op WITH params -> a typed
// class of those params (reqd:false -> nullable, defaulted null). An op WITHOUT
// params -> a match class over the entity fields, all nullable/optional (the
// PHP stand-in for TS `Partial<Name>`; callers may also pass a plain assoc-array).
//
// PHP has no generics and no structural typing, so these classes are documentation-
// grade value objects: op signatures keep a permissive native type (assoc-array in,
// mixed out at the item-5 boundary) and surface the class names via PHPDoc. The file
// lands under types/ and is registered on composer's classmap autoload (see
// Package_php.ts) so `new <Name>()` / type references resolve globally.

import {
  cmp, each,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'php'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op.
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match',
  list: 'Match',
  remove: 'Match',
  create: 'Data',
  update: 'Data',
}


// A valid PHP property/label name (identifiers only; the corpus never carries
// exotic field names, but guard so a bad name can never emit invalid PHP).
function validName(name: string): boolean {
  return /^[A-Za-z_\x80-\xff][A-Za-z0-9_\x80-\xff]*$/.test(name)
}


function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


// The generated type name for an op's request payload, e.g. ActivityLoadMatch.
function opTypeName(Name: string, opname: string): string {
  return Name + cap(opname) + (OP_SUFFIX[opname] || 'Match')
}


// Emit one typed PHP property line. `mixed` is already nullable in PHP and
// rejects the `?` prefix, so it is special-cased; every other optional field
// becomes `?type` with a `= null` default so the property is safely optional.
function propLine(name: string, sentinel: unknown, optional: boolean): string {
  const type = canonToType(sentinel, LANG)
  if ('mixed' === type) {
    return optional
      ? `    public mixed $${name} = null;\n`
      : `    public mixed $${name};\n`
  }
  return optional
    ? `    public ?${type} $${name} = null;\n`
    : `    public ${type} $${name};\n`
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

  Folder({ name: 'types' }, () => {

    File({ name: model.const.Name + 'Types.' + LANG }, () => {

      Content(`<?php
declare(strict_types=1);

// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.
//
// These are documentation-grade value objects (PHP 8 typed properties),
// registered on the composer classmap autoload. The SDK boundary exchanges
// assoc-arrays; these classes name the shapes for tooling and typed callers.

`)

      entityList.forEach((ent: any) => {
        const Name = ent.Name
        const fields = (ent.fields ? each(ent.fields) : [])
          .filter((f: any) => f.active !== false && validName(f.name))

        // Entity data model: one typed property per field (`req:false` -> nullable).
        Content(`/** ${Name} entity data model. */
class ${Name}
{
`)
        fields.forEach((f: any) => {
          Content(propLine(f.name, f.type, false === f.req))
        })
        Content(`}

`)

        // Per active op: a request/match class. With params -> a typed class of
        // those params; without params -> a match class over the entity fields,
        // all-optional (the PHP stand-in for TS Partial<${Name}>).
        const ops = ent.op || {}
        ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
          const op = ops[opname]
          if (null == op) {
            return
          }

          const typeName = opTypeName(Name, opname)
          const params = opParams(op)

          if (0 < params.length) {
            Content(`/** Request payload for ${Name}#${opname}. */
class ${typeName}
{
`)
            params.forEach((p: any) => {
              if (validName(p.name)) {
                Content(propLine(p.name, p.type, false === p.reqd))
              }
            })
            Content(`}

`)
          }
          else {
            Content(`/** Match filter for ${Name}#${opname} (any subset of ${Name} fields). */
class ${typeName}
{
`)
            fields.forEach((f: any) => {
              Content(propLine(f.name, f.type, true))
            })
            Content(`}

`)
          }
        })
      })
    })
  })
})


export {
  EntityTypes,
}
