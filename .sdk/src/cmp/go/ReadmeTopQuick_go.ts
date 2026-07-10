
import { cmp, Content, isAuthActive, envName, entityIdField, entityOps, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue, goVarName } from './utility_go'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `sdk.New${model.const.Name}SDK(map[string]any{\n    "apikey": os.Getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.New()`

  Content(`\`\`\`go
import sdk "${gomodule}"

client := ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // camelCase Go identifier (never snake_case, never a Go keyword).
    const eVar = goVarName(exampleEntity.name)
    // ACTIVE ops only — an inactive op generates no method, so an example
    // calling it would not compile.
    const opnames = entityOps(exampleEntity)

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s
${eVar}s, err := client.${eName}(nil).List(nil, nil)
if err != nil {
    panic(err)
}
fmt.Println(${eVar}s)
`)
      hasCall = true
    }

    // Find a nested entity for a more interesting example: one with a parent
    // chain (relations.ancestors), an active load op, and a required non-id
    // load param to demonstrate (the parent key, e.g. page_id).
    const nestedEntity = Object.values(entity).find((e: any) =>
      e.active !== false &&
      e.relations && e.relations.ancestors && 0 < e.relations.ancestors.length &&
      entityOps(e).includes('load') &&
      opRequestShape(e, 'load').items.some((it: any) =>
        !it.optional && it.name !== entityIdField(e))
    ) as any

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neVar = goVarName(nestedEntity.name)
      // Model-driven match: every REQUIRED load-match key — the same shape
      // that generates the op's request match, so the example always carries
      // the keys the route needs. Parent keys (e.g. page_id) first, the
      // entity's own id last, each value a type-correct Go literal.
      const neIdF = entityIdField(nestedEntity)
      const neLoadOp = nestedEntity.op && nestedEntity.op.load
      const neMatchPairs = opRequestShape(nestedEntity, 'load').items
        .filter((it: any) => !it.optional)
        .sort((a: any, b: any) =>
          (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
        .map((it: any) =>
          `"${it.name}": ${exampleValue(nestedEntity, neLoadOp, it.name,
            it.name === neIdF ? 'example_id' : 'example_' + it.name)}`)

      Content(`
// Load a specific ${neName.toLowerCase()}
${neVar}, err := client.${neName}(nil).Load(
    map[string]any{${neMatchPairs.join(', ')}}, nil,
)
if err != nil {
    panic(err)
}
fmt.Println(${neVar})
`)
      hasCall = true
    }

    // Fallback: APIs with only `load` (no list, no nested) — still show one call.
    if (!hasCall && opnames.includes('load')) {
      // Every REQUIRED load-match key (id first) — nil when there are none.
      const idF = entityIdField(exampleEntity)
      const loadItems = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `map[string]any{${loadItems.map((it: any) =>
          `"${it.name}": ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.load, it.name,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')}}`
        : 'nil'
      Content(`// Load ${eName.toLowerCase()} data
${eVar}, err := client.${eName}(nil).Load(${loadArg}, nil)
if err != nil {
    panic(err)
}
fmt.Println(${eVar})
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
