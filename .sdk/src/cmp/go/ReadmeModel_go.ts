
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  const apikeyOptionRow = isAuthActive(model)
    ? '| `"apikey"` | `string` | API key for authentication. |\n'
    : ''

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
    Content(`| \`${ent.Name}\` | \`(data map[string]any) ${model.const.Name}Entity\` | Create a ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface (${model.const.Name}Entity)

All entities implement the \`${model.const.Name}Entity\` interface.

| Method | Signature | Description |
| --- | --- | --- |
| \`Load\` | \`(reqmatch, ctrl map[string]any) (any, error)\` | Load a single entity by match criteria. |
| \`List\` | \`(reqmatch, ctrl map[string]any) (any, error)\` | List entities matching the criteria. |
| \`Create\` | \`(reqdata, ctrl map[string]any) (any, error)\` | Create a new entity. |
| \`Update\` | \`(reqdata, ctrl map[string]any) (any, error)\` | Update an existing entity. |
| \`Remove\` | \`(reqmatch, ctrl map[string]any) (any, error)\` | Remove an entity. |
| \`Data\` | \`(args ...any) any\` | Get or set entity data. |
| \`Match\` | \`(args ...any) any\` | Get or set entity match criteria. |
| \`Make\` | \`() Entity\` | Create a new instance with the same options. |
| \`GetName\` | \`() string\` | Return the entity name. |

### Result shape

Entity operations return \`(any, error)\`. The \`any\` value is a
\`map[string]any\` with these keys:

| Key | Type | Description |
| --- | --- | --- |
| \`"ok"\` | \`bool\` | \`true\` if the HTTP status is 2xx. |
| \`"status"\` | \`int\` | HTTP status code. |
| \`"headers"\` | \`map[string]any\` | Response headers. |
| \`"data"\` | \`any\` | Parsed JSON response body. |

On error, \`"ok"\` is \`false\` and \`"err"\` contains the error value.

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
