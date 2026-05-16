
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  // Find the first published entity for examples
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  // Find a nested entity if available
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
  ) as any

  const authActive = isAuthActive(model)
  const goImports = authActive
    ? `    "fmt"\n    "os"\n`
    : `    "fmt"\n`
  const apikeyArg = authActive
    ? `\n        "apikey": os.Getenv("${model.NAME}_APIKEY"),\n    `
    : ''

  Content(`### 1. Create a client

\`\`\`go
package main

import (
${goImports}
    sdk "${gomodule}"
    "${gomodule}/core"
)

func main() {
    client := sdk.New${model.const.Name}SDK(map[string]any{${apikeyArg}})
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()}s

\`\`\`go
    result, err := client.${eName}(nil).List(nil, nil)
    if err != nil {
        panic(err)
    }

    rm := core.ToMapAny(result)
    if rm["ok"] == true {
        for _, item := range rm["data"].([]any) {
            p := core.ToMapAny(item)
            fmt.Println(p["id"], p["name"])
        }
    }
\`\`\`

`)
    }

    if (nestedEntity && opnames.includes('load')) {
      const neName = nom(nestedEntity, 'Name')
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'

      Content(`### 3. Load a ${neName.toLowerCase()}

${neName} is nested under ${eName}, so provide the \`${parentParam}\`:

\`\`\`go
    ${neName.toLowerCase()} := client.${neName}(nil)
    result, err = ${neName.toLowerCase()}.Load(
        map[string]any{"${parentParam}": "example", "id": "example_id"}, nil,
    )
    if err != nil {
        panic(err)
    }

    rm = core.ToMapAny(result)
    if rm["ok"] == true {
        fmt.Println(rm["data"])
    }
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      Content(`### 3. Load a ${eName.toLowerCase()}

\`\`\`go
    result, err = client.${eName}(nil).Load(
        map[string]any{"id": "example_id"}, nil,
    )
    if err != nil {
        panic(err)
    }

    rm = core.ToMapAny(result)
    if rm["ok"] == true {
        fmt.Println(rm["data"])
    }
}
\`\`\`

`)
    }

    // CRUD operations
    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`go
`)
      if (opnames.includes('create')) {
        Content(`// Create
created, _ := client.${eName}(nil).Create(
    map[string]any{"name": "Example"}, nil,
)
cm := core.ToMapAny(created)
newID := core.ToMapAny(cm["data"])["id"]

`)
      }
      if (opnames.includes('update')) {
        Content(`// Update
client.${eName}(nil).Update(
    map[string]any{"id": newID, "name": "Example-Renamed"}, nil,
)

`)
      }
      if (opnames.includes('remove')) {
        Content(`// Remove
client.${eName}(nil).Remove(
    map[string]any{"id": newID}, nil,
)
`)
      }
      Content(`\`\`\`

`)
    }
  }

})


export {
  ReadmeQuick
}
