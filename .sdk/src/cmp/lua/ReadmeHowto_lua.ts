
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, pickExampleEntity, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct Lua literal for a field's canonical type.
function luaLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '{}'
  return '"example"'
}

function luaKey(name: string): string {
  return /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `load` on an op-less entity like Cloudsmith's `Abort`. primaryOp is null
  // only when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // Model-driven id key: null when the entity has no id-like field.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  let testCallArg = ''
  if (exampleEntity && isMatchOp) {
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => !it.optional || it.name === idF)
      .sort((a: any, b: any) => (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
    testCallArg = 0 < items.length
      ? `{ ${items.map((it: any) => `${luaKey(it.name)} = ${it.name === idF ? '"test01"' : luaLit(it.type)}`).join(', ')} }`
      : ''
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp)) {
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testCallArg = `{ ${chosen.map((it: any) => `${luaKey(it.name)} = ${luaLit(it.type)}`).join(', ')} }`
  }

  // The op-driven test-mode line, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a direct() call instead.
  const testModeExample = primaryOp
    ? `local result, err = client:${eName}():${primaryOp}(${testCallArg})
-- result is the returned data; err is set on failure`
    : `local result, err = client:direct({ path = "/api/resource", method = "GET" })
-- result is the returned data; err is set on failure`

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

${testModeExample}
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
