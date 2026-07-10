
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, pickExampleEntity, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { goVarName } from './utility_go'


// A type-correct Go literal for a field's canonical type.
function goLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]any{}'
  if ('OBJECT' === k) return 'map[string]any{}'
  return '"example"'
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `Load` on an op-less entity like Cloudsmith's `Abort`. primaryOp is null
  // only when NO entity exposes any op (a direct()-only SDK).
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // camelCase Go identifier (never snake_case or flattened lowercase,
  // never a Go keyword).
  const eLower = exampleEntity ? goVarName(exampleEntity.name) : 'entity'
  // Model-driven id key: null when the entity has no id-like field.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  let testArg = 'nil'
  if (exampleEntity && isMatchOp) {
    testArg = idF ? `map[string]any{"${idF}": "test01"}` : 'nil'
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp)) {
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testArg = `map[string]any{${chosen.map((it: any) => `"${it.name}": ${goLit(it.type)}`).join(', ')}}`
  }

  // The op-driven test-mode block, shown only when the SDK has an entity op.
  // A direct()-only SDK (no ops anywhere) shows a Direct() call instead — never
  // a fabricated method (`cap(primaryOp)` would also fail on a null op).
  const testModeExample = primaryOp
    ? `${eLower}, err := client.${eName}(nil).${cap(primaryOp)}(
    ${testArg}, nil,
)
if err != nil {
    panic(err)
}
fmt.Println(${eLower}) // the returned mock data`
    : `result, err := client.Direct(map[string]any{"path": "/api/resource", "method": "GET"})
if err != nil {
    panic(err)
}
fmt.Println(result)`

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`go
result, err := client.Direct(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "GET",
    "params": map[string]any{"id": "example"},
})
if err != nil {
    panic(err)
}

if result["ok"] == true {
    fmt.Println(result["status"]) // 200
    fmt.Println(result["data"])   // response body
}
\`\`\`

### Prepare a request without sending it

\`\`\`go
fetchdef, err := client.Prepare(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "DELETE",
    "params": map[string]any{"id": "example"},
})
if err != nil {
    panic(err)
}

fmt.Println(fetchdef["url"])
fmt.Println(fetchdef["method"])
fmt.Println(fetchdef["headers"])
\`\`\`

### Use test mode

Create a mock client for unit testing \u2014 no server required:

\`\`\`go
client := sdk.Test()

${testModeExample}
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`go
mockFetch := func(url string, init map[string]any) (map[string]any, error) {
    return map[string]any{
        "status":     200,
        "statusText": "OK",
        "headers":    map[string]any{},
        "json": (func() any)(func() any {
            return map[string]any{"id": "mock01"}
        }),
    }, nil
}

client := sdk.New${model.const.Name}SDK(map[string]any{
    "base": "http://localhost:8080",
    "system": map[string]any{
        "fetch": (func(string, map[string]any) (map[string]any, error))(mockFetch),
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
cd go && go test ./test/...
\`\`\`

`)

})


export {
  ReadmeHowto
}
