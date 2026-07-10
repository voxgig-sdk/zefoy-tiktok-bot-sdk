
import { cmp, each, Content, canonToType, entityIdField, entityOps, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { exampleValue, goVarName } from './utility_go'


// Operation method spelling differs between Go and other languages — Go
// uses PascalCase methods with explicit ctrl arg, others use lowercase
// methods with optional ctrl. The op descriptions are language-agnostic.
const OP_DESC: Record<string, { method: string, desc: string }> = {
  load:   { method: 'Load(match, ctrl)',   desc: 'Load a single entity by match criteria.' },
  list:   { method: 'List(match, ctrl)',   desc: 'List entities matching the criteria.' },
  create: { method: 'Create(data, ctrl)',  desc: 'Create a new entity with the given data.' },
  update: { method: 'Update(data, ctrl)',  desc: 'Update an existing entity.' },
  remove: { method: 'Remove(match, ctrl)', desc: 'Remove the matching entity.' },
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
    // ACTIVE ops only — an inactive op generates no method, so an example
    // calling it would not compile.
    const opnames = entityOps(entity)
    const fields = entity.fields || []
    // Model-driven id key: null when this entity has no id-like field.
    const idF = entityIdField(entity)
    // camelCase Go identifier (a `status_embed_config` entity must not bind a
    // snake_case Go variable, and a `type`/`range` entity not a Go keyword).
    const eVar = goVarName(entity.name)

    Content(`
### ${entity.Name}

`)

    if (entity.short) {
      Content(`${entity.short}

`)
    }

    Content(`Create an instance: \`${eVar} := client.${entity.Name}(nil)\`

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
      // page_id) — the same shape that generates the op's request match, so
      // the example always carries the keys the route needs.
      const loadItems = opRequestShape(entity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `map[string]any{${loadItems.map((it: any) =>
          `"${it.name}": ${exampleValue(entity, entity.op && entity.op.load, it.name,
            it.name === idF ? entity.name + '_id' : it.name)}`).join(', ')}}`
        : 'nil'
      Content(`#### Example: Load

\`\`\`go
${eVar}, err := client.${entity.Name}(nil).Load(${loadArg}, nil)
if err != nil {
    panic(err)
}
fmt.Println(${eVar}) // the loaded record
\`\`\`

`)
    }

    if (opnames.includes('list')) {
      Content(`#### Example: List

\`\`\`go
${eVar}s, err := client.${entity.Name}(nil).List(nil, nil)
if err != nil {
    panic(err)
}
fmt.Println(${eVar}s) // the array of records
\`\`\`

`)
    }

    if (opnames.includes('create')) {
      // Members come from the SAME shape that generates the op's request
      // data (every required member appears, including a required id), each
      // with a type-correct example VALUE via exampleValue — a
      // `"name": /* type */` comment is not a value and yields uncompilable
      // Go, so the example must carry a real literal.
      const createItems = opRequestShape(entity, 'create').items
        .filter((it: any) => !it.optional)
      Content(`#### Example: Create

\`\`\`go
result, err := client.${entity.Name}(nil).Create(map[string]any{
`)
      createItems.map((it: any) => {
        Content(`    "${it.name}": ${exampleValue(entity, entity.op && entity.op.create, it.name, 'example_' + it.name)},
`)
      })
      Content(`}, nil)
if err != nil {
    panic(err)
}
fmt.Println(result)
\`\`\`

`)
    }
  })
})


export {
  ReadmeEntity
}
