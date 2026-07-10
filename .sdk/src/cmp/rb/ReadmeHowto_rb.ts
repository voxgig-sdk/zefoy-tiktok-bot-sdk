
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, pickExampleEntity, opRequestShape, safeVarName } from '@voxgig/sdkgen'

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
  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `load` on an op-less entity like Cloudsmith's `Abort`. primaryOp is null
  // only when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // Sanitise the local variable name — an entity whose lowercased name is a
  // Ruby keyword (e.g. `self`) would otherwise emit uncompilable code. The
  // fixture KEY (`"${eName.toLowerCase()}"`) stays raw — it must match the
  // entity's registered name for the mock lookup to resolve.
  const eVar = safeVarName(eName.toLowerCase(), 'rb')
  // Model-driven id key: null when the entity has no id-like field (a
  // response-wrapped spec). When null the fixture seeds no id and a match op
  // takes no argument.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
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

  // The op-driven test-mode line, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a direct() call instead.
  const testModeExample = primaryOp
    ? `# Entity ops return the bare mock record (raises on error).
${eVar} = client.${eName}.${primaryOp}(${testCallArg})
puts ${eVar}`
    : `result = client.direct({ "path" => "/api/resource", "method" => "GET" })
puts result`

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

${testModeExample}
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
