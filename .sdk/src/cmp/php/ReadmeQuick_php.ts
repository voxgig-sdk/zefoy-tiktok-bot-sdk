
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
    ? `\n    "apikey" => getenv("${model.NAME}_APIKEY"),\n`
    : ''

  Content(`### 1. Create a client

\`\`\`php
<?php
require_once '${model.const.Name.toLowerCase()}_sdk.php';

$client = new ${model.const.Name}SDK([${apikeyArg}]);
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`php
[$result, $err] = $client->${eName}(null)->list(null, null);
if ($err) { throw new \\Exception($err); }

if (is_array($result)) {
    foreach ($result as $item) {
        $d = $item->data_get();
        echo $d["id"] . " " . $d["name"] . "\\n";
    }
}
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`php
[$result, $err] = $client->${eName}(null)->load(["id" => "example_id"], null);
if ($err) { throw new \\Exception($err); }
print_r($result);
\`\`\`

`)
    }

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`php
`)
      if (opnames.includes('create')) {
        Content(`// Create
[$created, $_] = $client->${eName}(null)->create(["name" => "Example"], null);

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update
$client->${eName}(null)->update(["id" => $created["id"], "name" => "Example-Renamed"], null);

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
$client->${eName}(null)->remove(["id" => $created["id"]], null);
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
