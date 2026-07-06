
import { cmp, each, Content, isAuthActive, entityIdField } from '@voxgig/sdkgen'

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
    load: '| `load` | `(reqmatch, ctrl) -> any, err` | Load a single entity by match criteria. |',
    list: '| `list` | `(reqmatch, ctrl) -> any, err` | List entities matching the criteria. |',
    create: '| `create` | `(reqdata, ctrl) -> any, err` | Create a new entity. |',
    update: '| `update` | `(reqdata, ctrl) -> any, err` | Update an existing entity. |',
    remove: '| `remove` | `(reqmatch, ctrl) -> any, err` | Remove an entity. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')

  // Model-driven Result-shape rows: only describe the operations that
  // actually exist. Record-returning ops (load/create/update/remove) share
  // one row; list has its own — never name a missing op.
  const recordOps = ['load', 'create', 'update', 'remove'].filter((o) => opUnion.has(o))
    .map((o) => '`' + o + '`')
  const resultRows: string[] = []
  if (recordOps.length) resultRows.push('| ' + recordOps.join(' / ') + ' | the entity record (a `table`) |')
  if (opUnion.has('list')) resultRows.push('| `list` | an array (`table`) of entity records |')
  const resultShapeRows = resultRows.join('\n')

  const exEnt: any = entityList[0] || {}
  const eName = exEnt.Name || 'Entity'
  const eLower = String(exEnt.name || 'entity').toLowerCase()
  // Model-driven id key: null when the example entity has no id-like field, so
  // the Result-shape load illustration takes no match argument.
  const idF = entityIdField(exEnt)

  const apikeyOptionRow = isAuthActive(model)
    ? '| `apikey` | `string` | API key for authentication. |\n'
    : ''

  Content(`### ${model.const.Name}SDK

\`\`\`lua
local sdk = require("${model.name}_sdk")
local client = sdk.new(options)
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`table\` | Feature activation flags. |
| \`extend\` | \`table\` | Additional Feature instances to load. |
| \`system\` | \`table\` | System overrides (e.g. custom \`fetch\` function). |

### test

\`\`\`lua
local client = sdk.test(testopts, sdkopts)
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`nil\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> table\` | Deep copy of current SDK options. |
| \`get_utility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs) -> table, err\` | Build an HTTP request definition without sending. |
| \`direct\` | \`(fetchargs) -> table, err\` | Build and send an HTTP request. |
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
| \`data_get\` | \`() -> table\` | Get entity data. |
| \`data_set\` | \`(data)\` | Set entity data. |
| \`match_get\` | \`() -> table\` | Get entity match criteria. |
| \`match_set\` | \`(match)\` | Set entity match criteria. |
| \`make\` | \`() -> Entity\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> string\` | Return the entity name. |

### Result shape

Entity operations return \`(value, err)\`. The \`value\` is the operation's
data **directly** — there is no wrapper:

| Operation | \`value\` |
| --- | --- |
${resultShapeRows}

Check \`err\` first (it is non-\`nil\` on failure), then use \`value\`:

    local ${eLower}, err = client:${eName}():load(${idF ? `{ ${idF} = "example_id" }` : ''})
    if err then error(err) end
    -- ${eLower} is the loaded record

Only \`direct()\` returns a response envelope — a \`table\` with \`ok\`,
\`status\`, \`headers\`, and \`data\` keys.

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
