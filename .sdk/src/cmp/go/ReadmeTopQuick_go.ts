
import { cmp, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const apikeyArg = isAuthActive(model)
    ? `\n    "apikey": os.Getenv("${model.NAME}_APIKEY"),\n`
    : ''

  Content(`\`\`\`go
import sdk "${gomodule}"

client := sdk.New${model.const.Name}SDK(map[string]any{${apikeyArg}})

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s
${eName.toLowerCase()}s, err := client.${eName}(nil).List(nil, nil)
`)
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
${neName.toLowerCase()}, err := client.${neName}(nil).Load(
    map[string]any{"${parentParam}": "example", "id": "example_id"}, nil,
)
`)
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
