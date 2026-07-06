
import { cmp, Content, isAuthActive, envName, entityIdField } from '@voxgig/sdkgen'

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
    // Model-driven id key: null when the entity has no id-like field, in which
    // case the load example takes no match argument.
    const idF = entityIdField(exampleEntity)

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`# List all ${eName.toLowerCase()}s (returns an Array; raises on error)
${eName.toLowerCase()}s = client.${eName}.list
puts ${eName.toLowerCase()}s
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      Content(`
# Load a specific ${eName.toLowerCase()} (returns the bare record; raises on error)
${eName.toLowerCase()} = client.${eName}.load(${idF ? `{ "${idF}" => "example_id" }` : ''})
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
