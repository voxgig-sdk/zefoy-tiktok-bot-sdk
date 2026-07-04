
import { cmp, each, Content, isAuthActive, packageName, envName } from '@voxgig/sdkgen'

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

  const ctor = isAuthActive(model)
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`ts
import { ${model.const.Name}SDK } from '${packageName(model, target.name)}'

const client = ${ctor}
\`\`\`

`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`ts
const result = await client.${eName.toLowerCase()}.list()

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
      const neArticle = /^[aeiou]/i.test(neName) ? 'an' : 'a'
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${eName}, so provide the \`${parentParam}\`:

\`\`\`ts
const ${neName.toLowerCase()} = client.${neName.toLowerCase()}
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
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`ts
const result = await client.${eName.toLowerCase()}.load({ id: 'example_id' })

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
const created = await client.${eName.toLowerCase()}.create({
  name: 'Example',
})

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update
const updated = await client.${eName.toLowerCase()}.update({
  id: created.data.id,
  name: 'Example-Renamed',
})

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
const removed = await client.${eName.toLowerCase()}.remove({
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
