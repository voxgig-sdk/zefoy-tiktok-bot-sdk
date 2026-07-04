
import { cmp, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`ruby
client = ${model.const.Name}SDK.test
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    Content(`result = client.${eName.toLowerCase()}.load({ "id" => "test01" })
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
