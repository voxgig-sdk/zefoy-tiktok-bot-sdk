
import { cmp, Content, canonKey, entityIdField, entityPrimaryOp, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct Go literal for a field's canonical type.
function goLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]any{}'
  if ('OBJECT' === k) return 'map[string]any{}'
  return '"example"'
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}


const ReadmeTopTest = cmp(function ReadmeTopTest(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  Content(`\`\`\`go
client := sdk.Test()
`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Drive the test-mode example off the entity's PRIMARY op (never a hardcoded
    // `Load` a create-only entity lacks).
    const idF = entityIdField(exampleEntity)
    const primaryOp = entityPrimaryOp(exampleEntity) || 'load'
    const isMatchOp = 'load' === primaryOp || 'remove' === primaryOp
    let arg = 'nil'
    if (isMatchOp) {
      arg = idF ? `map[string]any{"${idF}": "test01"}` : 'nil'
    } else if ('create' === primaryOp || 'update' === primaryOp) {
      const items = opRequestShape(exampleEntity, primaryOp).items
        .filter((it: any) => it.name !== idF && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      const chosen = required.length ? required : items.slice(0, 3)
      arg = `map[string]any{${chosen.map((it: any) => `"${it.name}": ${goLit(it.type)}`).join(', ')}}`
    }
    Content(`result, err := client.${eName}(nil).${cap(primaryOp)}(
    ${arg}, nil,
)
`)
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopTest
}
