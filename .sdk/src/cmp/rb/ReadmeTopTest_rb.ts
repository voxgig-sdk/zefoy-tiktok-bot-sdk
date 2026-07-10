
import { cmp, Content, canonKey, entityIdField, pickExampleEntity, opRequestShape, safeVarName } from '@voxgig/sdkgen'

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


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `load` on an op-less entity like Cloudsmith's `Abort`.
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)

  if (exampleEntity && primaryOp) {
    const eName = nom(exampleEntity, 'Name')
    const ename = eName.toLowerCase()
    // Model-driven id key: null when the entity has no id-like field, so the
    // seeded record carries no id and a match op takes no argument.
    const idF = entityIdField(exampleEntity)
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    const recBody = idF ? `{ "${idF}" => "test01" }` : '{}'
    let callArg = ''
    if (isMatchOp) {
      // Every REQUIRED match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      callArg = 0 < items.length
        ? `{ ${items.map((it: any) =>
          `"${it.name}" => ${it.name === idF ? '"test01"' : rbLit(it.type)}`).join(', ')} }`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      callArg = `{ ${chosen.map((it: any) => `"${it.name}" => ${rbLit(it.type)}`).join(', ')} }`
    }
    // A list result is an Array — name the variable accordingly. Sanitise the
    // base name — an entity whose lowercased name is a Ruby keyword (e.g.
    // `self`) would otherwise emit uncompilable code. The fixture KEY (`ename`)
    // stays raw so the mock lookup resolves.
    const eVar = safeVarName(ename, 'rb') + ('list' === primaryOp ? 's' : '')
    Content(`\`\`\`ruby
# Seed fixture data so offline calls resolve without a live server.
client = ${model.const.Name}SDK.test({
  "entity" => { "${ename}" => { "test01" => ${recBody} } },
})
${eVar} = client.${eName}.${primaryOp}(${callArg})
\`\`\`
`)
  } else {
    Content(`\`\`\`ruby
client = ${model.const.Name}SDK.test
\`\`\`
`)
  }

})


export {
  ReadmeTopTest
}
