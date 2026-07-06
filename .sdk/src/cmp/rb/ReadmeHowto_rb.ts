
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct Ruby literal for a field's canonical type.
function rbLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]'
  if ('OBJECT' === k) return '{}'
  return '"example"'
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // Model-driven id key: null when the entity has no id-like field (a
  // response-wrapped spec). When null the fixture seeds no id and a match op
  // takes no argument.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  // Drive the test-mode example off the entity's PRIMARY op — an op it actually
  // exposes — never a hardcoded `load` a create-only entity lacks.
  const primaryOp = exampleEntity ? (entityPrimaryOp(exampleEntity) || 'load') : 'load'
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  const seedSentence = idF
    ? '. Seed fixture\ndata via the `entity` option so offline calls resolve without a live server'
    : ''
  const testCtor = idF
    ? `${model.const.Name}SDK.test({\n  "entity" => { "${eName.toLowerCase()}" => { "test01" => { "${idF}" => "test01" } } },\n})`
    : `${model.const.Name}SDK.test`
  // A type-correct argument for the primary-op call: a match hash for load/
  // remove, a required-field body for create/update, nothing for list.
  let testCallArg = ''
  if (exampleEntity && isMatchOp) {
    testCallArg = idF ? `{ "${idF}" => "test01" }` : ''
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp)) {
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testCallArg = `{ ${chosen.map((it: any) => `"${it.name}" => ${rbLit(it.type)}`).join(', ')} }`
  }

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`ruby
result = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example" },
})

if result["ok"]
  puts result["status"]  # 200
  puts result["data"]    # response body
else
  # On an HTTP error status there is no err (only a transport failure sets
  # it), so fall back to the status code.
  warn(result["err"] || "HTTP #{result["status"]}")
end
\`\`\`

### Prepare a request without sending it

\`\`\`ruby
begin
  fetchdef = client.prepare({
    "path" => "/api/resource/{id}",
    "method" => "DELETE",
    "params" => { "id" => "example" },
  })
  puts fetchdef["url"]
  puts fetchdef["method"]
  puts fetchdef["headers"]
rescue => err
  warn "prepare failed: #{err}"
end
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required${seedSentence}:

\`\`\`ruby
client = ${testCtor}

# Entity ops return the bare mock record (raises on error).
${eName.toLowerCase()} = client.${eName}.${primaryOp}(${testCallArg})
puts ${eName.toLowerCase()}
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`ruby
mock_fetch = ->(url, init) {
  return {
    "status" => 200,
    "statusText" => "OK",
    "headers" => {},
    "json" => ->() { { "id" => "mock01" } },
  }, nil
}

client = ${model.const.Name}SDK.new({
  "base" => "http://localhost:8080",
  "system" => {
    "fetch" => mock_fetch,
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
cd rb && ruby -Itest -e "Dir['test/*_test.rb'].each { |f| require_relative f }"
\`\`\`

`)

})


export {
  ReadmeHowto
}
