
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

  const apikeyArg = isAuthActive(model)
    ? `\n  "apikey" => ENV["${model.NAME}_APIKEY"],\n`
    : ''

  Content(`### 1. Create a client

\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${model.const.Name}SDK.new({${apikeyArg}})
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`ruby
result, err = client.${eName}(nil).list(nil, nil)
raise err if err

if result.is_a?(Array)
  result.each do |item|
    d = item.data_get
    puts "#{d["id"]} #{d["name"]}"
  end
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`ruby
result, err = client.${eName}(nil).load({ "id" => "example_id" }, nil)
raise err if err
puts result
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`ruby
`)
      if (opnames.includes('create')) {
        Content(`# Create
created, _ = client.${eName}(nil).create({ "name" => "Example" }, nil)

`)
      }
      if (opnames.includes('update')) {
        Content(`# Update
client.${eName}(nil).update({ "id" => created["id"], "name" => "Example-Renamed" }, nil)

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}(nil).remove({ "id" => created["id"] }, nil)
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
