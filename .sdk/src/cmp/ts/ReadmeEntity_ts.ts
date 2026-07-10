
import { cmp, each, Content, canonToType, entityIdField, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


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
    // Variable-safe lowercase name (a `Delete` entity must not bind `delete`).
    const eVar = safeVarName(entity.name, target.name)

    Content(`
### ${entity.Name}

`)

    if (entity.short) {
      Content(`${entity.short}

`)
    }

    Content(`Create an instance: \`const ${eVar} = client.${entity.Name}()\`

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
      // page_id) — the same shape that generates <Name>LoadMatch, so the
      // example always type-checks.
      const loadItems = opRequestShape(entity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `{ ${loadItems.map((it: any) =>
          `${it.name}: ${exampleValue(entity, entity.op && entity.op.load, it.name,
            it.name === idF ? entity.name + '_id' : it.name)}`).join(', ')} }`
        : ''
      Content(`#### Example: Load

\`\`\`ts
const ${eVar} = await client.${entity.Name}().load(${loadArg})
\`\`\`

`)
    }

    if (opnames.includes('list')) {
      Content(`#### Example: List

\`\`\`ts
const ${eVar}s = await client.${entity.Name}().list()
\`\`\`

`)
    }

    if (opnames.includes('create')) {
      // Members come from the SAME shape that generates <Name>CreateData
      // (every required member appears), with a type-correct example VALUE
      // via exampleValue — a `name: /* type */` comment is not a value and
      // yields invalid TS (TS1109), so the example must carry a real literal.
      const createItems = opRequestShape(entity, 'create').items
        .filter((it: any) => !it.optional)
      Content(`#### Example: Create

\`\`\`ts
const ${eVar} = await client.${entity.Name}().create({
`)
      createItems.map((it: any) => {
        Content(`  ${it.name}: ${exampleValue(entity, entity.op && entity.op.create, it.name, 'example_' + it.name)},
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
