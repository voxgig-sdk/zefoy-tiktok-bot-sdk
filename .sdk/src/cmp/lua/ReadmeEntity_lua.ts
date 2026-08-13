
import { cmp, each, Content, canonToType, canonKey, entityIdField, opRequestShape, safeVarName, exampleVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// A type-correct, executable Lua literal for a param: numeric/boolean/table
// params render a typed literal; strings render the quoted placeholder (the
// doc test EXECUTES runnable blocks, so a comment placeholder would not
// parse).
function luaLit(type: any, placeholder: string = 'example'): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '{}'
  return `"${placeholder}"`
}

// Non-identifier table keys use bracket syntax.
function luaKey(name: string): string {
  return /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
}


// Operation method spelling differs between Go and other languages — Go
// uses PascalCase methods with explicit ctrl arg, others use lowercase
// methods with optional ctrl. The op descriptions are language-agnostic.
const OP_DESC: Record<string, { method: string, desc: string }> = {
  load:   { method: 'load(match)',   desc: 'Load a single entity by match criteria.' },
  list:   { method: 'list(match)',   desc: 'List entities matching the criteria.' },
  create: { method: 'create(data)',  desc: 'Create a new entity with the given data.' },
  update: { method: 'update(data)',  desc: 'Update an existing entity.' },
  remove: { method: 'remove(match)', desc: 'Remove the matching entity.' },
}


const ReadmeEntity = cmp(function ReadmeEntity(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const publishedEntities = each(entity)
    .filter((entity: any) => entity.active !== false)

  if (0 === publishedEntities.length) {
    return
  }

  Content(`

## Entities

`)

  publishedEntities.map((entity: any) => {
    const opnames = Object.keys(entity.op || {})
    const fields = entity.fields || []
    // Model-driven id key: null when this entity has no id-like field.
    const idF = entityIdField(entity)
    // Sanitise the local variable name — an entity whose lowercased name is a
    // Lua keyword (e.g. `end`) would otherwise emit uncompilable code.
    const eVar = exampleVarName(entity.name, 'lua')

    Content(`
### ${entity.Name}

`)

    if (entity.short) {
      Content(`${entity.short}

`)
    }

    Content(`Create an instance: \`local ${eVar} = client:${entity.Name}(nil)\`

`)

    if (opnames.length > 0) {
      Content(`#### Operations

| Method | Description |
| --- | --- |
`)
      opnames.map((opname: string) => {
        const info = OP_DESC[opname]
        if (info) {
          Content(`| \`${info.method}\` | ${info.desc} |
`)
        }
      })

      Content(`
`)
    }

    if (fields.length > 0) {
      Content(`#### Fields

| Field | Type | Description |
| --- | --- | --- |
`)

      each(fields, (field: any) => {
        const desc = field.short || ''
        Content(`| \`${field.name}\` | \`${canonToType(field.type, target.name)}\` | ${desc} |
`)
      })

      Content(`
`)
    }

    if (opnames.includes('load')) {
      // The id key plus every REQUIRED match key (parent path params like
      // page_id) — the same shape the runtime resolves path params from, so
      // the example always works.
      const loadItems = opRequestShape(entity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `{ ${loadItems.map((it: any) =>
          `${luaKey(it.name)} = ${luaLit(it.type,
            it.name === idF ? entity.name + '_id' : it.name)}`).join(', ')} }`
        : ''
      Content(`#### Example: Load

\`\`\`lua
local ${eVar}, err = client:${entity.Name}():load(${loadArg})
\`\`\`

`)
    }

    if (opnames.includes('list')) {
      Content(`#### Example: List

\`\`\`lua
local ${eVar}s, err = client:${entity.Name}():list()
\`\`\`

`)
    }

    if (opnames.includes('create')) {
      // Members come from the SAME shape the runtime validates
      // (opRequestShape): every required member must appear — including a
      // required id and parent keys like page_id — with a real, executable
      // literal (the doc test RUNS this block, so a nil member would vanish
      // from the table and a comment placeholder would not parse).
      const createItems = opRequestShape(entity, 'create').items
        .filter((it: any) => !it.optional)
      Content(`#### Example: Create

\`\`\`lua
local ${eVar}, err = client:${entity.Name}():create({
`)
      createItems.map((it: any) => {
        Content(`  ${luaKey(it.name)} = ${luaLit(it.type, 'example_' + it.name)}, -- ${canonToType(it.type, target.name)}
`)
      })
      Content(`})
\`\`\`

`)
    }
  })
})


export {
  ReadmeEntity
}
