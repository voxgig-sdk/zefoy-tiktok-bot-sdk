
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
  const ctor = authActive
    ? `sdk.new({\n  apikey = os.getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.new()`

  Content(`\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`-- List all ${eName.toLowerCase()}s
local ${eName.toLowerCase()}s, err = client:${eName.toLowerCase()}():list()
print(${eName.toLowerCase()}s)
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      Content(`
-- Load a specific ${eName.toLowerCase()}
local ${eName.toLowerCase()}, err = client:${eName.toLowerCase()}():load({ id = "example_id" })
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
