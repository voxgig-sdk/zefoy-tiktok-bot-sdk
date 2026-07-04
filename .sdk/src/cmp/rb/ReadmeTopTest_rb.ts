
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

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const ename = eName.toLowerCase()
    Content(`\`\`\`ruby
# Seed fixture data so offline calls resolve without a live server.
client = ${model.const.Name}SDK.test({
  "entity" => { "${ename}" => { "test01" => { "id" => "test01" } } },
})
${ename} = client.${eName}.load({ "id" => "test01" })
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
