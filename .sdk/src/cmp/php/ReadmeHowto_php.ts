
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

import { KIT, getModelPath, nom } from '@voxgig/apidef'


// A type-correct PHP literal for a field's canonical type.
function phpLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '[]'
  return '"example"'
}


const ReadmeHowto = cmp(function ReadmeHowto(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {}).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'
  // Model-driven id key: null when the entity has no id-like field.
  const idF = exampleEntity ? entityIdField(exampleEntity) : null
  // Drive the test-mode example off the entity's PRIMARY op — never a hardcoded
  // `load` a create-only entity lacks.
  const primaryOp = exampleEntity ? (entityPrimaryOp(exampleEntity) || 'load') : 'load'
  const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
  const seedSentence = idF
    ? '. Seed fixture\ndata via the `entity` option so offline calls resolve without a live server'
    : ''
  const testCtor = idF
    ? `${model.const.Name}SDK::test([\n    "entity" => ["${eName.toLowerCase()}" => ["test01" => ["${idF}" => "test01"]]],\n])`
    : `${model.const.Name}SDK::test()`
  let testCallArg = ''
  if (exampleEntity && isMatchOp) {
    testCallArg = idF ? `["${idF}" => "test01"]` : ''
  } else if (exampleEntity && ('create' === primaryOp || 'update' === primaryOp)) {
    const items = opRequestShape(exampleEntity, primaryOp).items
      .filter((it: any) => it.name !== idF && it.name !== 'id')
    const required = items.filter((it: any) => !it.optional)
    const chosen = required.length ? required : items.slice(0, 3)
    testCallArg = `[${chosen.map((it: any) => `"${it.name}" => ${phpLit(it.type)}`).join(', ')}]`
  }

  const apikeyEnvLine = isAuthActive(model)
    ? `\n${envName(model)}_APIKEY=<your-key>`
    : ''

  Content(`### Make a direct HTTP request

For endpoints not covered by entity methods:

\`\`\`php
// direct() is the raw-HTTP escape hatch: it returns a result array
// (it does not throw). Branch on $result["ok"].
$result = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example"],
]);

if ($result["ok"]) {
    echo $result["status"];  // 200
    print_r($result["data"]);  // response body
} else {
    // On an HTTP error status there is no err (only a transport failure sets
    // it), so fall back to the status code.
    $err = $result["err"] ?? null;
    echo "Error: " . ($err ? $err->getMessage() : "HTTP " . $result["status"]);
}
\`\`\`

### Prepare a request without sending it

\`\`\`php
// prepare() throws on error and returns the fetch definition.
$fetchdef = $client->prepare([
    "path" => "/api/resource/{id}",
    "method" => "DELETE",
    "params" => ["id" => "example"],
]);

echo $fetchdef["url"];
echo $fetchdef["method"];
print_r($fetchdef["headers"]);
\`\`\`

### Use test mode

Create a mock client for unit testing — no server required${seedSentence}:

\`\`\`php
$client = ${testCtor};

// Entity ops return the bare mock record (throws on error).
$${eName.toLowerCase()} = $client->${eName}()->${primaryOp}(${testCallArg});
print_r($${eName.toLowerCase()});
\`\`\`

### Use a custom fetch function

Replace the HTTP transport with your own function:

\`\`\`php
$mock_fetch = function ($url, $init) {
    return [
        [
            "status" => 200,
            "statusText" => "OK",
            "headers" => [],
            "json" => function () { return ["id" => "mock01"]; },
        ],
        null,
    ];
};

$client = new ${model.const.Name}SDK([
    "base" => "http://localhost:8080",
    "system" => [
        "fetch" => $mock_fetch,
    ],
]);
\`\`\`

### Run live tests

Create a \`.env.local\` file at the project root:

\`\`\`
${envName(model)}_TEST_LIVE=TRUE${apikeyEnvLine}
\`\`\`

Then run:

\`\`\`bash
cd php && ./vendor/bin/phpunit test/
\`\`\`

`)

})


export {
  ReadmeHowto
}
