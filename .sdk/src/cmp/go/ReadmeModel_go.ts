
import { cmp, each, Content, isAuthActive, entityIdField, entityPrimaryOp, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a
  // Load/List/Create/Update/Remove row only for operations at least one active
  // entity actually exposes (a read-only entity has just List+Load) — never
  // document an operation no entity has. Model op keys are lowercase; Go
  // method names are capitalised.
  const opUnion = new Set<string>()
  entityList.forEach((e: any) => Object.keys(e.op || {})
    .forEach((o: string) => { if (e.op[o] && e.op[o].active !== false) opUnion.add(o) }))
  const opRowDefs: Record<string, string> = {
    load: '| `Load` | `(reqmatch, ctrl map[string]any) (any, error)` | Load a single entity by match criteria. |',
    list: '| `List` | `(reqmatch, ctrl map[string]any) (any, error)` | List entities matching the criteria. |',
    create: '| `Create` | `(reqdata, ctrl map[string]any) (any, error)` | Create a new entity. |',
    update: '| `Update` | `(reqdata, ctrl map[string]any) (any, error)` | Update an existing entity. |',
    remove: '| `Remove` | `(reqmatch, ctrl map[string]any) (any, error)` | Remove an entity. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')

  // Model-driven Result-shape rows: only describe the operations that
  // actually exist. Record-returning ops (Load/Create/Update/Remove) share
  // one row; List has its own — never name a missing op.
  const recordOps = ['load', 'create', 'update', 'remove'].filter((o) => opUnion.has(o))
    .map((o) => '`' + o.charAt(0).toUpperCase() + o.slice(1) + '`')
  const resultRows: string[] = []
  if (recordOps.length) resultRows.push('| ' + recordOps.join(' / ') + ' | the entity record (`map[string]any`) |')
  if (opUnion.has('list')) resultRows.push('| `List` | a `[]any` of entity records |')
  const resultShapeRows = resultRows.join('\n')

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const apikeyOptionRow = isAuthActive(model)
    ? '| `"apikey"` | `string` | API key for authentication. |\n'
    : ''

  // First published entity name, for the Result shape illustration.
  const firstEntityName = (entityList[0] as any)?.Name || 'Entity'
  const firstEntityVar = safeVarName(firstEntityName.toLowerCase(), 'go')
  // Model-driven id key: null when the example entity has no id-like field, so
  // the Result-shape illustration passes a nil match.
  const firstIdF = entityIdField(entityList[0] || {})
  // The example entity's PRIMARY op — an op it actually exposes (never a
  // hardcoded `Load` a create-only entity lacks).
  const firstPrimaryOp = entityList[0] ? (entityPrimaryOp(entityList[0]) || 'load') : 'load'
  const firstPrimaryMethod = firstPrimaryOp.charAt(0).toUpperCase() + firstPrimaryOp.slice(1)
  const firstIsMatchOp = 'load' === firstPrimaryOp || 'remove' === firstPrimaryOp
  const firstOpArg = firstIsMatchOp
    ? (firstIdF ? `map[string]any{"${firstIdF}": "example_id"}` : 'nil')
    : 'map[string]any{/* fields */}'

  Content(`### New${model.const.Name}SDK

\`\`\`go
func New${model.const.Name}SDK(options map[string]any) *${model.const.Name}SDK
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`"base"\` | \`string\` | Base URL of the API server. |
| \`"prefix"\` | \`string\` | URL path prefix prepended to all requests. |
| \`"suffix"\` | \`string\` | URL path suffix appended to all requests. |
| \`"feature"\` | \`map[string]any\` | Feature activation flags. |
| \`"extend"\` | \`[]any\` | Additional Feature instances to load. |
| \`"system"\` | \`map[string]any\` | System overrides (e.g. custom \`"fetch"\` function). |

### TestSDK

\`\`\`go
func TestSDK(testopts map[string]any, sdkopts map[string]any) *${model.const.Name}SDK
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`nil\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`OptionsMap\` | \`() map[string]any\` | Deep copy of current SDK options. |
| \`GetUtility\` | \`() *Utility\` | Copy of the SDK utility object. |
| \`Prepare\` | \`(fetchargs map[string]any) (map[string]any, error)\` | Build an HTTP request definition without sending. |
| \`Direct\` | \`(fetchargs map[string]any) (map[string]any, error)\` | Build and send an HTTP request. |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}\` | \`(data map[string]any) ${model.const.Name}Entity\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface (${model.const.Name}Entity)

All entities implement the \`${model.const.Name}Entity\` interface.

| Method | Signature | Description |
| --- | --- | --- |
${opRows}
| \`Data\` | \`(args ...any) any\` | Get or set entity data. |
| \`Match\` | \`(args ...any) any\` | Get or set entity match criteria. |
| \`Make\` | \`() Entity\` | Create a new instance with the same options. |
| \`GetName\` | \`() string\` | Return the entity name. |

### Result shape

Entity operations return \`(value, error)\`. The \`value\` is the
operation's data **directly** — there is no wrapper:

| Operation | \`value\` |
| --- | --- |
${resultShapeRows}

Check \`err\` first, then use the value directly (or the typed
\`...Typed\` variants, which return the entity's model struct and a typed
slice):

    ${firstEntityVar}, err := client.${firstEntityName}(nil).${firstPrimaryMethod}(${firstOpArg}, nil)
    if err != nil { /* handle */ }
    // ${firstEntityVar} is the returned record

Only \`Direct()\` returns a response envelope — a \`map[string]any\` with
\`"ok"\`, \`"status"\`, \`"headers"\`, and \`"data"\` keys.

`)

  // Entities summary
  Content(`### Entities

`)
  each(entityList, (ent: any) => {
    const fields = ent.fields || []
    const opnames = Object.keys(ent.op || {})
    const ops = ent.op || {}
    const points = each(ops).map((op: any) =>
      op.points ? each(op.points) : []
    ).flat()
    const path = points.length > 0 ? (points[0] as any).orig || '' : ''

    Content(`#### ${ent.Name}

| Field | Description |
| --- | --- |
`)
    each(fields, (field: any) => {
      Content(`| \`"${field.name}"\` | ${field.short || ''} |
`)
    })

    Content(`
Operations: ${opnames.map((n: string) => n.charAt(0).toUpperCase() + n.slice(1)).join(', ')}.

API path: \`${path}\`

`)
  })

})


export {
  ReadmeModel
}
