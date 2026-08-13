
import { cmp, Content, canonKey, entityIdField, pickExampleEntity, opRequestShape, safeVarName, exampleVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct Python literal for a field's canonical type.
function pyLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'True'
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

  Content(`\`\`\`python
client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity && primaryOp) {
    const eName = nom(exampleEntity, 'Name')
    const idF = entityIdField(exampleEntity)
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    let arg = ''
    if (isMatchOp) {
      // Every REQUIRED match key (id first) — the same shape that generates
      // the op's Match type, so the block also satisfies the mypy doc gate.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      arg = 0 < items.length
        ? `{${items.map((it: any) =>
          `"${it.name}": ${it.name === idF ? '"test01"' : pyLit(it.type)}`).join(', ')}}`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{${chosen.map((it: any) => `"${it.name}": ${pyLit(it.type)}`).join(', ')}}`
    }
    // A list() result is a list — name the variable accordingly (the root
    // README doc gate concatenates blocks, so reusing the singular name for
    // a different type is a mypy assignment error).
    const eVar = exampleVarName(eName.toLowerCase(), 'py') + ('list' === primaryOp ? 's' : '')
    Content(`${eVar} = client.${eName}().${primaryOp}(${arg})
print(${eVar})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
