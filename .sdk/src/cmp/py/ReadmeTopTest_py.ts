
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

  Content(`\`\`\`python
client = ${model.const.Name}SDK.test(None, None)
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    Content(`result, err = client.${eName}(None).load(
    {"id": "test01"}, None
)
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
