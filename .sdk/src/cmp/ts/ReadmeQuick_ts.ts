
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
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` resolves to an array of ${eName} objects — iterate it directly:

\`\`\`ts
const ${eName.toLowerCase()}s = await client.${eName}().list()

for (const ${eName.toLowerCase()} of ${eName.toLowerCase()}s) {
  console.log(${eName.toLowerCase()})
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

${neName} is nested under ${eName}, so provide the \`${parentParam}\`.
\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${neName.toLowerCase()} = await client.${neName}().load({
    ${parentParam}: 'example',
    id: 'example_id',
  })
  console.log(${neName.toLowerCase()})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${eName.toLowerCase()} = await client.${eName}().load({ id: 'example_id' })
  console.log(${eName.toLowerCase()})
} catch (err) {
  console.error('load failed:', err)
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
        Content(`// Create — returns the created ${eName}
const created = await client.${eName}().create({
  name: 'Example',
})

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update — the id comes straight off the returned entity
const updated = await client.${eName}().update({
  id: created.id,
  name: 'Example-Renamed',
})

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
await client.${eName}().remove({
  id: created.id,
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
