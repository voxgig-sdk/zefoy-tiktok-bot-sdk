
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct, executable PHP literal for a param: numeric/boolean/array
// params render a typed literal; strings render the quoted placeholder (the
// doc test EXECUTES this block, so a comment placeholder would break it).
function phpLit(type: any, placeholder: string = 'example'): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '[]'
  return `"${placeholder}"`
}


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
    // Model-driven id key: null when the entity has no id-like field, in which
    // case the load example takes no match argument.
    const idF = entityIdField(exampleEntity)

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s (returns an array; throws on error)
$${eName.toLowerCase()}s = $client->${eName}()->list();
print_r($${eName.toLowerCase()}s);
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      // Every REQUIRED load-match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from, so
      // the example always works.
      const loadItems = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `[${loadItems.map((it: any) =>
          `"${it.name}" => ${phpLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')}]`
        : ''
      Content(`
// Load a specific ${eName.toLowerCase()} (returns the bare record; throws on error)
$${eName.toLowerCase()} = $client->${eName}()->load(${loadArg});
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
