
import { cmp, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const apikeyArg = isAuthActive(model)
    ? `\n  "apikey" => ENV["${model.NAME}_APIKEY"],\n`
    : ''

  Content(`\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${model.const.Name}SDK.new({${apikeyArg}})

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`# List all ${eName.toLowerCase()}s
${eName.toLowerCase()}s, err = client.${eName}(nil).list(nil, nil)
`)
    }

    if (opnames.includes('load')) {
      Content(`
# Load a specific ${eName.toLowerCase()}
${eName.toLowerCase()}, err = client.${eName}(nil).load(
  { "id" => "example_id" }, nil
)
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
