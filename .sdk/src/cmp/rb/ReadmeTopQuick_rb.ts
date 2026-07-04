
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
    ? `${model.const.Name}SDK.new({\n  "apikey" => ENV["${envName(model)}_APIKEY"],\n})`
    : `${model.const.Name}SDK.new`

  Content(`\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`# List all ${eName.toLowerCase()}s
${eName.toLowerCase()}s = client.${eName.toLowerCase()}.list
puts ${eName.toLowerCase()}s
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      Content(`
# Load a specific ${eName.toLowerCase()}
${eName.toLowerCase()} = client.${eName.toLowerCase()}.load({ "id" => "example_id" })
puts ${eName.toLowerCase()}
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
