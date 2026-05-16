
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Find the first published entity for examples
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  // Find a nested entity if available
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
  ) as any

  const apikeyArg = isAuthActive(model)
    ? `\n  apikey: process.env.${model.NAME}_APIKEY,\n`
    : ''

  Content(`### 1. Create a client

\`\`\`ts
import { ${model.const.Name}SDK } from '${target.module.name}'

const client = new ${model.const.Name}SDK({${apikeyArg}})
\`\`\`

`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`ts
const result = await client.${eName}().list()

if (result.ok) {
  for (const item of result.data) {
    console.log(item.id, item.name)
  }
}
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'

      Content(`### 3. Load a ${neName.toLowerCase()}

${neName} is nested under ${eName}, so provide the \`${parentParam}\`:

\`\`\`ts
const ${neName.toLowerCase()} = client.${neName}()
const result = await ${neName.toLowerCase()}.load({
  ${parentParam}: 'example',
  id: 'example_id',
})

if (result.ok) {
  console.log(result.data)
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`ts
const result = await client.${eName}().load({ id: 'example_id' })

if (result.ok) {
  console.log(result.data)
}
\`\`\`

`)
    }

    // CRUD operations
    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`ts
`)
      if (opnames.includes('create')) {
        Content(`// Create
const created = await client.${eName}().create({
  name: 'Example',
})

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update
const updated = await client.${eName}().update({
  id: created.data.id,
  name: 'Example-Renamed',
})

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
const removed = await client.${eName}().remove({
  id: created.data.id,
})
`)
      }
      Content(`\`\`\`

`)
    }
  }

})


export {
  ReadmeQuick
}
