
import { cmp, Content, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

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

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`python
client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Drive the test-mode example off the entity's PRIMARY op (never a
    // hardcoded `load` a create-only entity lacks).
    const idF = entityIdField(exampleEntity)
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    let arg = ''
    if (isMatchOp) {
      arg = idF ? `{"${idF}": "test01"}` : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{${chosen.map((it: any) => `"${it.name}": ${pyLit(it.type)}`).join(', ')}}`
    }
    Content(`${eName.toLowerCase()} = client.${eName}().${primaryOp}(${arg})
print(${eName.toLowerCase()})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
