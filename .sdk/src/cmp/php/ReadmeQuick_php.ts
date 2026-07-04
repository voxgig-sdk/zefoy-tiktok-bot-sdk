
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
    ? `new ${model.const.Name}SDK([\n    "apikey" => getenv("${envName(model)}_APIKEY"),\n])`
    : `new ${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`php
<?php
require_once '${model.const.Name.toLowerCase()}_sdk.php';

$client = ${ctor};
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`\`\`php
try {
    // list() returns an array of ${eName} records — iterate directly.
    $${eName.toLowerCase()}s = $client->${eName}()->list();
    foreach ($${eName.toLowerCase()}s as $item) {
        echo $item["id"] . " " . $item["name"] . "\\n";
    }
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`php
try {
    // load() returns the bare ${eName} record (throws on error).
    $${eName.toLowerCase()} = $client->${eName}()->load(["id" => "example_id"]);
    print_r($${eName.toLowerCase()});
} catch (\\Throwable $err) {
    echo "Error: " . $err->getMessage();
}
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`php
`)
      if (opnames.includes('create')) {
        Content(`// create() returns the bare created ${eName} record.
$created = $client->${eName}()->create(["name" => "Example"]);

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update — index the bare record directly ($created["id"]).
$client->${eName}()->update(["id" => $created["id"], "name" => "Example-Renamed"]);

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
$client->${eName}()->remove(["id" => $created["id"]]);
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
