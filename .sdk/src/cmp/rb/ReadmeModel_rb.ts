
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  // Model-driven op rows for the shared entity interface: emit a
  // load/list/create/update/remove row only for operations at least one active
  // entity actually exposes (a read-only entity has just list+load) — never
  // document an operation no entity has.
  const opUnion = new Set<string>()
  entityList.forEach((e: any) => Object.keys(e.op || {})
    .forEach((o: string) => { if (e.op[o] && e.op[o].active !== false) opUnion.add(o) }))
  const opRowDefs: Record<string, string> = {
    load: '| `load` | `(reqmatch, ctrl) -> any` | Load a single entity by match criteria. Raises on error. |',
    list: '| `list` | `(reqmatch = nil, ctrl) -> Array` | List entities matching the criteria (call with no argument to list all). Raises on error. |',
    create: '| `create` | `(reqdata, ctrl) -> any` | Create a new entity. Raises on error. |',
    update: '| `update` | `(reqdata, ctrl) -> any` | Update an existing entity. Raises on error. |',
    remove: '| `remove` | `(reqmatch, ctrl) -> any` | Remove an entity. Raises on error. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')

  const apikeyOptionRow = isAuthActive(model)
    ? '| `apikey` | `String` | API key for authentication. |\n'
    : ''

  Content(`### ${model.const.Name}SDK

\`\`\`ruby
require_relative "${model.const.Name}_sdk"
client = ${model.const.Name}SDK.new(options)
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`base\` | \`String\` | Base URL of the API server. |
| \`prefix\` | \`String\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`String\` | URL path suffix appended to all requests. |
| \`feature\` | \`Hash\` | Feature activation flags. |
| \`extend\` | \`Hash\` | Additional Feature instances to load. |
| \`system\` | \`Hash\` | System overrides (e.g. custom \`fetch\` lambda). |

### test

\`\`\`ruby
client = ${model.const.Name}SDK.test(testopts, sdkopts)
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`nil\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> Hash\` | Deep copy of current SDK options. |
| \`get_utility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs) -> Hash\` | Build an HTTP request definition without sending. Raises on error. |
| \`direct\` | \`(fetchargs) -> Hash\` | Build and send an HTTP request. Returns a result hash (\`result["ok"]\`); does not raise. |
`)

  each(entityList, (ent: any) => {
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}\` | \`(data) -> ${ent.Name}Entity\` | Create ${article} ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

All entities share the same interface.

| Method | Signature | Description |
| --- | --- | --- |
${opRows}
| \`data_get\` | \`() -> Hash\` | Get entity data. |
| \`data_set\` | \`(data)\` | Set entity data. |
| \`match_get\` | \`() -> Hash\` | Get entity match criteria. |
| \`match_set\` | \`(match)\` | Set entity match criteria. |
| \`make\` | \`() -> Entity\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> String\` | Return the entity name. |

### Result shape

Entity operations return the result data directly. On failure they
raise a \`${model.const.Name}Error\` (a \`StandardError\` subclass), so wrap
calls in \`begin\`/\`rescue\` where you need to handle errors.

The \`direct\` escape hatch is the exception: it never raises and instead
returns a result \`Hash\` with these keys:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`Boolean\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`Integer\` | HTTP status code. |
| \`headers\` | \`Hash\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |
| \`err\` | \`Error\` | Present when \`ok\` is \`false\`. |

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
      Content(`| \`${field.name}\` | ${field.short || ''} |
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
