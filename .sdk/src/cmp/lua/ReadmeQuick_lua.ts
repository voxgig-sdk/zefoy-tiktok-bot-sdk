
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
    ? `sdk.new({\n  apikey = os.getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.new()`

  Content(`### 1. Create a client

\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

Entity operations return \`(value, err)\`. For \`list\`, \`value\` is the
array of records itself — iterate it directly (there is no wrapper).

\`\`\`lua
local ${eName.toLowerCase()}s, err = client:${eName}():list()
if err then error(err) end

for _, item in ipairs(${eName.toLowerCase()}s) do
  print(item["id"], item["name"])
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`lua
local ${eName.toLowerCase()}, err = client:${eName}():load({ id = "example_id" })
if err then error(err) end
print(${eName.toLowerCase()})
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`lua
`)
      if (opnames.includes('create')) {
        Content(`-- Create
local created, err = client:${eName}():create({ name = "Example" })
if err then error(err) end

`)
      }
      if (opnames.includes('update')) {
        Content(`-- Update
client:${eName}():update({ id = created["id"], name = "Example-Renamed" })

`)
      }
      if (opnames.includes('remove')) {
        Content(`-- Remove
client:${eName}():remove({ id = created["id"] })
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
