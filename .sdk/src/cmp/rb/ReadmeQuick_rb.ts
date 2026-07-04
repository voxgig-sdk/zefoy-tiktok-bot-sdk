
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

  const ctor = isAuthActive(model)
    ? `${model.const.Name}SDK.new({\n  "apikey" => ENV["${envName(model)}_APIKEY"],\n})`
    : `${model.const.Name}SDK.new`

  Content(`### 1. Create a client

\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`\`\`ruby
begin
  # list returns an Array of ${eName} records — iterate directly.
  ${eName.toLowerCase()}s = client.${eName}.list
  ${eName.toLowerCase()}s.each do |item|
    puts "#{item["id"]} #{item["name"]}"
  end
rescue => err
  warn "list failed: #{err}"
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`ruby
begin
  # load returns the bare ${eName} record (raises on error).
  ${eName.toLowerCase()} = client.${eName}.load({ "id" => "example_id" })
  puts ${eName.toLowerCase()}
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`ruby
`)
      if (opnames.includes('create')) {
        Content(`# create returns the bare created ${eName} record.
created = client.${eName}.create({ "name" => "Example" })

`)
      }
      if (opnames.includes('update')) {
        Content(`# Update — index the bare record directly (created["id"]).
client.${eName}.update({ "id" => created["id"], "name" => "Example-Renamed" })

`)
      }
      if (opnames.includes('remove')) {
        Content(`# Remove
client.${eName}.remove({ "id" => created["id"] })
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
