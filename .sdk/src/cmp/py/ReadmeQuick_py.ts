
import { cmp, each, Content, isAuthActive, envName } from '@voxgig/sdkgen'

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
  const ctor = authActive
    ? `${model.const.Name}SDK({\n    "apikey": os.environ.get("${envName(model)}_APIKEY"),\n})`
    : `${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`python
${apikeyImport}from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`python
try:
    result = client.${eName.toLowerCase()}.list()
    for item in result:
        d = item.data_get()
        print(d["id"], d["name"])
except Exception as err:
    print(f"list failed: {err}")
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`python
try:
    result = client.${eName.toLowerCase()}.load({"id": "example_id"})
    print(result)
except Exception as err:
    print(f"load failed: {err}")
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`python
`)
      if (opnames.includes('create')) {
        Content(`# Create
created = client.${eName.toLowerCase()}.create({"name": "Example"})

`)
      }
      if (opnames.includes('update')) {
        Content(`# Update
client.${eName.toLowerCase()}.update({"id": created["id"], "name": "Example-Renamed"})

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName.toLowerCase()}.remove({"id": created["id"]})
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
