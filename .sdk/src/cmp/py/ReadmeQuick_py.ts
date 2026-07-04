
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
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` returns a \`list\` of records (each a \`dict\`) and raises on
error — iterate it directly.

\`\`\`python
try:
    ${eName.toLowerCase()}s = client.${eName}().list({})
    for ${eName.toLowerCase()} in ${eName.toLowerCase()}s:
        print(${eName.toLowerCase()})
except Exception as err:
    print(f"list failed: {err}")
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the bare record (a \`dict\`) and raises on error.

\`\`\`python
try:
    ${eName.toLowerCase()} = client.${eName}().load({"id": "example_id"})
    print(${eName.toLowerCase()})
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
        Content(`# Create — returns the bare created record (a dict)
created = client.${eName}().create({"name": "Example"})

`)
      }
      if (opnames.includes('update')) {
        Content(`# Update — the created record's id is a plain dict key
client.${eName}().update({"id": created["id"], "name": "Example-Renamed"})

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}().remove({"id": created["id"]})
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
