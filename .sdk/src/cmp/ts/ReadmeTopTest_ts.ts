
import { cmp, Content, entityIdField, entityPrimaryOp, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`ts
const client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const eVar = safeVarName(eName.toLowerCase(), 'ts')
    // Drive the test-mode example off the entity's PRIMARY op (never a
    // hardcoded `load` a create-only entity lacks).
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    const primaryOpDef = exampleEntity.op && exampleEntity.op[primaryOp]
    const idF = entityIdField(exampleEntity)
    let arg = ''
    if ('load' === primaryOp || 'remove' === primaryOp) {
      arg = idF ? `{ ${idF}: ${exampleValue(exampleEntity, primaryOpDef, idF, 'test01')} }` : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{ ${chosen.map((it: any) =>
        `${it.name}: ${exampleValue(exampleEntity, primaryOpDef, it.name, 'example_' + it.name)}`).join(', ')} }`
    }
    Content(`const ${eVar} = await client.${eName}().${primaryOp}(${arg})
// ${eVar} is a bare ${eName} populated with mock data
console.log(${eVar})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
