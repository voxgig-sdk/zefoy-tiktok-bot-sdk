
import { cmp, Content, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct PHP literal for a field's canonical type.
function phpLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '[]'
  return '"example"'
}


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const ename = eName.toLowerCase()
    // Model-driven id key: null when the entity has no id-like field.
    const idF = entityIdField(exampleEntity)
    // Drive the test-mode example off the entity's PRIMARY op (never a hardcoded
    // `load` a create-only entity lacks).
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    const recBody = idF ? `["${idF}" => "test01"]` : '[]'
    let callArg = ''
    if (isMatchOp) {
      callArg = idF ? `["${idF}" => "test01"]` : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      callArg = `[${chosen.map((it: any) => `"${it.name}" => ${phpLit(it.type)}`).join(', ')}]`
    }
    Content(`\`\`\`php
// Seed fixture data so offline calls resolve without a live server.
$client = ${model.const.Name}SDK::test([
    "entity" => ["${ename}" => ["test01" => ${recBody}]],
]);
$${ename} = $client->${eName}()->${primaryOp}(${callArg});
\`\`\`
`)
  } else {
    Content(`\`\`\`php
$client = ${model.const.Name}SDK::test();
\`\`\`
`)
  }

})


export {
  ReadmeTopTest
}
