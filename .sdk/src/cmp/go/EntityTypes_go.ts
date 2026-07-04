

// Typed-model generator (Go target).
//
// Reads main.<KIT>.entity.<e>.fields[] and per-op params
// (op.<name>.points[].args.params[]) and emits one file, entity/types.go, in
// the `entity` package, with a Go `type <Name> struct { ... }` per entity plus
// a request/match struct per active op. Field/param sentinels ($STRING,
// $INTEGER, ...) are turned into real Go types by the shared sdkgen helper
// `canonToType` (source of truth: @voxgig/apidef VALID_CANON).
//
// PORT NOTES (Go specifics vs the TS reference):
//   * Types live in the SAME package as the entity methods (`entity`), so the
//     generated typed accessors reference them without an import (task step B).
//   * Go has no method overloading and go-cli / go-mcp dispatch entities
//     dynamically through the untyped `core.ProjectNameEntity` interface
//     (Load/List/... (map[string]any) (any, error)). That interface — and the
//     untyped concrete methods that satisfy it — are therefore KEPT unchanged.
//     Typed access is delivered ADDITIVELY: the op fragments emit `LoadTyped`
//     / `ListTyped` / ... alongside the untyped methods, and Entity.fragment.go
//     emits `DataTyped` / `MatchTyped`. All are thin typed wrappers over the
//     untyped runtime (identical behaviour), converting at the typed boundary
//     via the JSON-round-trip helpers emitted at the bottom of this file.
//   * `list` typed op returns []<Name>; other typed ops return <Name>.
//   * op WITH params -> a struct of those params (reqd:false -> pointer +
//     ,omitempty). op WITHOUT params -> a struct mirroring the entity fields
//     with every field optional (Go's analog of TS `Partial<Name>`).

import {
  cmp, each,
  File, Content, Folder,
} from '@voxgig/sdkgen'

import { canonToType } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const LANG = 'go'


// The five ops, and whether their request payload is a `Match` (query/id) or
// `Data` (body) — this fixes the generated type-name suffix per op (kept
// IDENTICAL to EntityTypes_ts.ts).
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


// A model field/param name -> an exported Go field identifier:
//   advice -> Advice, some_field -> SomeField, id -> Id.
function goField(name: string): string {
  const out = String(name)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  // Go identifiers can't start with a digit.
  return /^[A-Za-z_]/.test(out) ? out : 'F' + out
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


// One Go struct field line. `optional` -> pointer + ,omitempty (Go's closest
// analog to an optional/absent field).
function fieldLine(name: string, sentinel: any, optional: boolean): string {
  const gt = canonToType(sentinel, LANG)
  const typ = optional ? ('*' + gt) : gt
  const tag = optional ? `\`json:"${name},omitempty"\`` : `\`json:"${name}"\``
  return `\t${goField(name)} ${typ} ${tag}\n`
}


const EntityTypes = cmp(function EntityTypes(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Emit for every entity that gets an entity file. Main_go.ts iterates
  // entities WITHOUT an `active` filter, so a struct is required for each so
  // the typed accessors in every *_entity.go resolve at compile time.
  const entityList = each(entity).filter((e: any) => e && null != e.Name)

  Folder({ name: 'entity' }, () => {

    File({ name: 'types.' + target.ext }, () => {

      Content(`// Typed models for the ${model.const.Name} SDK.
//
// GENERATED from the API model: main.${KIT}.entity.<e>.fields[] and per-op
// params (op.<name>.points[].args.params[]). Field/param types come from the
// canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
// @voxgig/apidef VALID_CANON). Do not edit by hand.
package entity

import "encoding/json"

`)

      entityList.forEach((ent: any) => {
        const Name = ent.Name
        const fields = (ent.fields ? each(ent.fields) : [])
          .filter((f: any) => f.active !== false)

        // Entity data model: one field per model field. req:false -> pointer.
        Content(`// ${Name} is the typed data model for the ${ent.name} entity.
type ${Name} struct {
`)
        fields.forEach((f: any) => {
          Content(fieldLine(f.name, f.type, false === f.req))
        })
        Content(`}

`)

        // Per active op: a request/match struct (same package as the entity
        // methods, so no import is needed there). With params -> a struct of
        // those params; without params -> a struct mirroring the entity fields
        // with every field optional (Go analog of TS `Partial<${Name}>`).
        const ops = ent.op || {}
        ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
          const op = ops[opname]
          if (null == op) {
            return
          }

          const typeName = opTypeName(Name, opname)
          const params = opParams(op)

          if (0 < params.length) {
            Content(`// ${typeName} is the typed request payload for ${Name}.${cap(opname)}Typed.
type ${typeName} struct {
`)
            params.forEach((p: any) => {
              Content(fieldLine(p.name, p.type, false === p.reqd))
            })
            Content(`}

`)
          }
          else {
            Content(`// ${typeName} mirrors the ${ent.name} fields as an all-optional match
// filter (Go analog of Partial<${Name}>).
type ${typeName} struct {
`)
            fields.forEach((f: any) => {
              Content(fieldLine(f.name, f.type, true))
            })
            Content(`}

`)
          }
        })
      })

      // Conversion helpers shared by the generated typed accessors/methods.
      // Kept unexported and package-local so the typed boundary stays a pure
      // wrapper over the untyped runtime.
      Content(`// asMap turns a typed request/data struct into the map[string]any the
// runtime op pipeline consumes, honouring the json tags above.
func asMap(v any) map[string]any {
	out := map[string]any{}
	b, err := json.Marshal(v)
	if err != nil {
		return out
	}
	_ = json.Unmarshal(b, &out)
	return out
}

// typedFrom decodes a runtime value (a map[string]any produced by the op
// pipeline) into a typed model T via a JSON round-trip. On any error it
// returns the zero value of T; the op's own (value, error) tuple carries the
// real error.
func typedFrom[T any](v any) T {
	var out T
	if v == nil {
		return out
	}
	b, err := json.Marshal(v)
	if err != nil {
		return out
	}
	_ = json.Unmarshal(b, &out)
	return out
}

// typedSliceFrom decodes a runtime list value ([]any of maps) into a typed
// slice []T via a JSON round-trip, for list ops.
func typedSliceFrom[T any](v any) []T {
	var out []T
	if v == nil {
		return out
	}
	b, err := json.Marshal(v)
	if err != nil {
		return out
	}
	_ = json.Unmarshal(b, &out)
	return out
}
`)

    })
  })
})


export {
  EntityTypes,
}
