
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
  ) as any

  const authActive = isAuthActive(model)
  const apikeyImport = authActive ? `import os\n` : ''
  const apikeyArg = authActive
    ? `\n    "apikey": os.environ.get("${model.NAME}_APIKEY"),\n`
    : ''

  Content(`### 1. Create a client

\`\`\`python
${apikeyImport}from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK({${apikeyArg}})
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`python
result, err = client.${eName}(None).list(None, None)
if err:
    raise Exception(err)

if isinstance(result, list):
    for item in result:
        d = item.data_get()
        print(d["id"], d["name"])
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`python
result, err = client.${eName}(None).load({"id": "example_id"}, None)
if err:
    raise Exception(err)
print(result)
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`python
`)
      if (opnames.includes('create')) {
        Content(`# Create
created, _ = client.${eName}(None).create({"name": "Example"}, None)

`)
      }
      if (opnames.includes('update')) {
        Content(`# Update
client.${eName}(None).update({"id": created["id"], "name": "Example-Renamed"}, None)

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}(None).remove({"id": created["id"]}, None)
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
