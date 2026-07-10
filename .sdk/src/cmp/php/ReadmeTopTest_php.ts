
import { cmp, Content, canonKey, entityIdField, pickExampleEntity, opRequestShape } from '@voxgig/sdkgen'

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

  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `load` on an op-less entity like Cloudsmith's `Abort`.
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)

  if (exampleEntity && primaryOp) {
    const eName = nom(exampleEntity, 'Name')
    const ename = eName.toLowerCase()
    // Model-driven id key: null when the entity has no id-like field.
    const idF = entityIdField(exampleEntity)
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    const recBody = idF ? `["${idF}" => "test01"]` : '[]'
    let callArg = ''
    if (isMatchOp) {
      // Every REQUIRED match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      callArg = 0 < items.length
        ? `[${items.map((it: any) =>
          `"${it.name}" => ${it.name === idF ? '"test01"' : phpLit(it.type)}`).join(', ')}]`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      callArg = `[${chosen.map((it: any) => `"${it.name}" => ${phpLit(it.type)}`).join(', ')}]`
    }
    // A list result is an array — name the variable accordingly.
    const eVar = ename + ('list' === primaryOp ? 's' : '')
    Content(`\`\`\`php
// Seed fixture data so offline calls resolve without a live server.
$client = ${model.const.Name}SDK::test([
    "entity" => ["${ename}" => ["test01" => ${recBody}]],
]);
$${eVar} = $client->${eName}()->${primaryOp}(${callArg});
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
