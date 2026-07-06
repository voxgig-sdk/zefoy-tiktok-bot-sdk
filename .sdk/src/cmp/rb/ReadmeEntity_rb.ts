
import { cmp, each, Content, canonToType, canonKey, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// A type-correct Ruby literal for a field's canonical type — the create body
// is EXECUTED by the doc test, so it must carry a real value per field.
function rbLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]'
  if ('OBJECT' === k) return '{}'
  return '"example"'
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

    Content(`
### ${entity.Name}

`)

    if (entity.short) {
      Content(`${entity.short}

`)
    }

    Content(`Create an instance: \`${entity.name} = client.${entity.Name}\`

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
      Content(`#### Example: Load

\`\`\`ruby
# load returns the bare ${entity.Name} record (raises on error).
${entity.name} = client.${entity.Name}.load(${idF ? `{ "${idF}" => "${entity.name}_id" }` : ''})
\`\`\`

`)
    }

    if (opnames.includes('list')) {
      Content(`#### Example: List

\`\`\`ruby
# list returns an Array of ${entity.Name} records (raises on error).
${entity.name}s = client.${entity.Name}.list
\`\`\`

`)
    }

    if (opnames.includes('create')) {
      Content(`#### Example: Create

\`\`\`ruby
${entity.name} = client.${entity.Name}.create({
`)
      each(fields, (field: any) => {
        if ('id' !== field.name && field.req) {
          Content(`  "${field.name}" => ${rbLit(field.type)}, # ${canonToType(field.type, target.name)}
`)
        }
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
