
import { cmp, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${model.NAME}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`\`\`\`ts
import { ${model.const.Name}SDK } from '${target.module.name}'

const client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s
const ${eName.toLowerCase()}s = await client.${eName}().list()
console.log(${eName.toLowerCase()}s.data)
`)
      hasCall = true
    }

    // Find a nested entity for a more interesting example
    const nestedEntity = Object.values(entity).find((e: any) =>
      e.active !== false && e.ancestors && e.ancestors.length > 0
    ) as any

    if (nestedEntity && opnames.includes('load')) {
      const neName = nom(nestedEntity, 'Name')
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'

      Content(`
// Load a specific ${neName.toLowerCase()}
const ${neName.toLowerCase()} = await client.${neName}().load({
  ${parentParam}: 'example',
  id: 'example_id',
})
console.log(${neName.toLowerCase()}.data)
`)
      hasCall = true
    }

    // Fallback: APIs with only `load` (no list, no nested) — most public
    // read-only services. Still show one concrete call.
    if (!hasCall && opnames.includes('load')) {
      Content(`// Load ${eName.toLowerCase()} data
const ${eName.toLowerCase()} = await client.${eName}().load({})
console.log(${eName.toLowerCase()}.data)
`)
      hasCall = true
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
