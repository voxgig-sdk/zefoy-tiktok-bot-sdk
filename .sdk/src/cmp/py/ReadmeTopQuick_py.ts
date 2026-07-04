
import { cmp, Content, isAuthActive, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const apikeyImport = authActive ? `import os\n` : ''
  const ctor = authActive
    ? `${model.const.Name}SDK({\n    "apikey": os.environ.get("${envName(model)}_APIKEY"),\n})`
    : `${model.const.Name}SDK()`

  Content(`\`\`\`python
${apikeyImport}from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`# List all ${eName.toLowerCase()}s
${eName.toLowerCase()}s = client.${eName.toLowerCase()}.list()
print(${eName.toLowerCase()}s)
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      Content(`
# Load a specific ${eName.toLowerCase()}
${eName.toLowerCase()} = client.${eName.toLowerCase()}.load({"id": "example_id"})
print(${eName.toLowerCase()})
`)
      hasCall = true
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
