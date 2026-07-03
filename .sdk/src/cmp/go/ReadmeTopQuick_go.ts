
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
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `sdk.New${model.const.Name}SDK(map[string]any{\n    "apikey": os.Getenv("${model.NAME}_APIKEY"),\n})`
    : `sdk.New()`

  Content(`\`\`\`go
import sdk "${gomodule}"

client := ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s
${eName.toLowerCase()}s, err := client.${eName}(nil).List(nil, nil)
fmt.Println(${eName.toLowerCase()}s)
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
${neName.toLowerCase()}, err := client.${neName}(nil).Load(
    map[string]any{"${parentParam}": "example", "id": "example_id"}, nil,
)
fmt.Println(${neName.toLowerCase()})
`)
      hasCall = true
    }

    // Fallback: APIs with only `load` (no list, no nested) — still show one call.
    if (!hasCall && opnames.includes('load')) {
      Content(`// Load ${eName.toLowerCase()} data
${eName.toLowerCase()}, err := client.${eName}(nil).Load(map[string]any{}, nil)
fmt.Println(${eName.toLowerCase()})
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
