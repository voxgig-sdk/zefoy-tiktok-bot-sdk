
import { cmp, Content, entityIdField, pickExampleEntity, opRequestShape, safeVarName, exampleVarName, jsKey } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Pick an entity with a real op (prefer a read op) — never fabricate a
  // `load` on an op-less entity like Cloudsmith's `Abort`.
  const { entity: exampleEntity, primaryOp } = pickExampleEntity(entity)

  // The mock SEEDS NOTHING on its own.
  //
  // `SDK.test()` with no argument used to be shown alongside "populated with
  // mock data" — and returned an empty array. The seed shape
  // (`{ entity: { <name>: { <id>: {...} } } }`) was documented nowhere; the
  // only way to find it was to read TestFeature.ts. Offline test mode is a
  // headline feature of these SDKs, so its one worked example has to run.
  const seedEntity = exampleEntity ? nom(exampleEntity, 'name') : ''
  const seedFields = exampleEntity ?
    opRequestShape(exampleEntity, 'create').items
      .filter((it: any) => !it.optional)
      .slice(0, 3) : []

  const seedId = 'test01'
  const seedBody = [
    `${jsKey('id')}: '${seedId}'`,
    ...seedFields
      .filter((it: any) => 'id' !== it.name)
      .map((it: any) => `${jsKey(it.name)}: ${exampleValue(
        exampleEntity, exampleEntity.op && exampleEntity.op.create, it.name,
        'example_' + it.name)}`),
  ].join(', ')

  Content(`\`\`\`ts
// The offline mock starts EMPTY — seed it with the records the test needs.
// Shape: { entity: { <entity-name>: { <id>: <record> } } }
const client = ${model.const.Name}SDK.test({
  entity: {
    ${seedEntity}: {
      ${seedId}: { ${seedBody} },
    },
  },
})
`)

  if (exampleEntity && primaryOp) {
    const eName = nom(exampleEntity, 'Name')
    // A list() result is an array — name the variable accordingly.
    const eVar = exampleVarName(eName.toLowerCase(), 'ts') +
      ('list' === primaryOp ? 's' : '')
    const primaryOpDef = exampleEntity.op && exampleEntity.op[primaryOp]
    const idF = entityIdField(exampleEntity)
    let arg = ''
    if ('load' === primaryOp || 'remove' === primaryOp) {
      // Every REQUIRED match key (id first) — the same shape that generates
      // the op's Match type, so the block type-checks.
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      arg = 0 < items.length
        ? `{ ${items.map((it: any) =>
          `${jsKey(it.name)}: ${exampleValue(exampleEntity, primaryOpDef, it.name,
            it.name === idF ? 'test01' : 'example_' + it.name)}`).join(', ')} }`
        : ''
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `{ ${chosen.map((it: any) =>
        `${jsKey(it.name)}: ${exampleValue(exampleEntity, primaryOpDef, it.name, 'example_' + it.name)}`).join(', ')} }`
    }
    Content(`const ${eVar} = await client.${eName}().${primaryOp}(${arg})
// ${eVar} is ${'list' === primaryOp ? `an array of ${eName} entities` : `the ${eName} entity`}, populated with mock data
// — call ${eVar}${'list' === primaryOp ? '[0]' : ''}.data() for the record itself
console.log(${eVar})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
