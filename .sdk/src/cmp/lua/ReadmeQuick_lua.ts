
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
    ? `\n  apikey = os.getenv("${model.NAME}_APIKEY"),\n`
    : ''

  Content(`### 1. Create a client

\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = sdk.new({${apikeyArg}})
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`lua
local result, err = client:${eName}(nil):list(nil, nil)
if err then error(err) end

if type(result) == "table" then
  for _, item in ipairs(result) do
    local d = item:data_get()
    print(d["id"], d["name"])
  end
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`lua
local result, err = client:${eName}(nil):load({ id = "example_id" }, nil)
if err then error(err) end
print(result)
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`lua
`)
      if (opnames.includes('create')) {
        Content(`-- Create
local created, _ = client:${eName}(nil):create({ name = "Example" }, nil)

`)
      }
      if (opnames.includes('update')) {
        Content(`-- Update
client:${eName}(nil):update({ id = created["id"], name = "Example-Renamed" }, nil)

`)
      }
      if (opnames.includes('remove')) {
        Content(`-- Remove
client:${eName}(nil):remove({ id = created["id"] }, nil)
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
