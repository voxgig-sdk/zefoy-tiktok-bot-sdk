
import { cmp, Content, canonKey } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct example literal for a field: numeric canon types must
// render as a bare number (the generated match/field types are `number`,
// so a quoted string would be a compile error in the TS snippet test).
function exampleLiteral(entity: any, placeholder: string): string {
  const idName = (entity.id && entity.id.field) || 'id'
  const idField = (entity.fields || []).find((f: any) => f.name === idName)
  const key = canonKey(idField && idField.type)
  if ('INTEGER' === key || 'NUMBER' === key) return '1'
  if ('BOOLEAN' === key) return 'true'
  return `'${placeholder}'`
}


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`ts
const client = ${model.const.Name}SDK.test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const idName = (exampleEntity.id && exampleEntity.id.field) || 'id'
    Content(`const ${eName.toLowerCase()} = await client.${eName}().load({ ${idName}: ${exampleLiteral(exampleEntity, 'test01')} })
// ${eName.toLowerCase()} is a bare ${eName} populated with mock data
console.log(${eName.toLowerCase()})
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
