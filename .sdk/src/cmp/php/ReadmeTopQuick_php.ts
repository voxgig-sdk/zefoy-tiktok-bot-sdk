
import { cmp, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const apikeyArg = isAuthActive(model)
    ? `\n    "apikey" => getenv("${model.NAME}_APIKEY"),\n`
    : ''

  Content(`\`\`\`php
<?php
require_once '${model.const.Name.toLowerCase()}_sdk.php';

$client = new ${model.const.Name}SDK([${apikeyArg}]);

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s
[$${eName.toLowerCase()}s, $err] = $client->${eName}(null)->list(null, null);
`)
    }

    if (opnames.includes('load')) {
      Content(`
// Load a specific ${eName.toLowerCase()}
[$${eName.toLowerCase()}, $err] = $client->${eName}(null)->load(
    ["id" => "example_id"], null
);
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
