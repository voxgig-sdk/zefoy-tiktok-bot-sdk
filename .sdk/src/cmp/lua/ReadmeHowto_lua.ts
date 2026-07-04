
import { cmp, Content, isAuthActive, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`lua
local result, err = client:direct({
  path = "/api/resource/{id}",
  method = "GET",
  params = { id = "example" },
})
if err then error(err) end

if result["ok"] then
  print(result["status"])  -- 200
  print(result["data"])    -- response body
end
\`\`\`

### Prepare a request without sending it

\`\`\`lua
local fetchdef, err = client:prepare({
  path = "/api/resource/{id}",
  method = "DELETE",
  params = { id = "example" },
})
if err then error(err) end

print(fetchdef["url"])
print(fetchdef["method"])
print(fetchdef["headers"])
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required:

\`\`\`lua
local client = sdk.test()

local result, err = client:${eName.toLowerCase()}():load({ id = "test01" })
-- result contains mock response data
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`lua
local function mock_fetch(url, init)
  return {
    status = 200,
    statusText = "OK",
    headers = {},
    json = function()
      return { id = "mock01" }
    end,
  }, nil
end

local client = sdk.new({
  base = "http://localhost:8080",
  system = {
    fetch = mock_fetch,
  },
})
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd lua && busted test/
\`\`\`

`)

})


export {
  ReadmeHowto
}
