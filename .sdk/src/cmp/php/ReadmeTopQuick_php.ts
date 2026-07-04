
import { cmp, Content, isAuthActive, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `new ${model.const.Name}SDK([\n    "apikey" => getenv("${envName(model)}_APIKEY"),\n])`
    : `new ${model.const.Name}SDK()`

  Content(`\`\`\`php
<?php
require_once '${model.const.Name.toLowerCase()}_sdk.php';

$client = ${ctor};

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s (throws on error)
$${eName.toLowerCase()}s = $client->${eName.toLowerCase()}()->list();
print_r($${eName.toLowerCase()}s);
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      Content(`
// Load a specific ${eName.toLowerCase()}
$${eName.toLowerCase()} = $client->${eName.toLowerCase()}()->load(["id" => "example_id"]);
print_r($${eName.toLowerCase()});
`)
      hasCall = true
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
