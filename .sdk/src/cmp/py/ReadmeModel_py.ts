
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  const apikeyOptionRow = isAuthActive(model)
    ? '| `apikey` | `str` | API key for authentication. |\n'
    : ''

  Content(`### ${model.const.Name}SDK

\`\`\`python
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK(options)
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`base\` | \`str\` | Base URL of the API server. |
| \`prefix\` | \`str\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`str\` | URL path suffix appended to all requests. |
| \`feature\` | \`dict\` | Feature activation flags. |
| \`extend\` | \`list\` | Additional Feature instances to load. |
| \`system\` | \`dict\` | System overrides (e.g. custom \`fetch\` function). |

### test

\`\`\`python
client = ${model.const.Name}SDK.test(testopts, sdkopts)
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`None\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`() -> dict\` | Deep copy of current SDK options. |
| \`get_utility\` | \`() -> Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(fetchargs) -> (dict, err)\` | Build an HTTP request definition without sending. |
| \`direct\` | \`(fetchargs) -> (dict, err)\` | Build and send an HTTP request. |
`)

  each(entityList, (ent: any) => {
    Content(`| \`${ent.Name}\` | \`(data) -> ${ent.Name}Entity\` | Create a ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

All entities share the same interface.

| Method | Signature | Description |
| --- | --- | --- |
| \`load\` | \`(reqmatch, ctrl) -> (any, err)\` | Load a single entity by match criteria. |
| \`list\` | \`(reqmatch, ctrl) -> (any, err)\` | List entities matching the criteria. |
| \`create\` | \`(reqdata, ctrl) -> (any, err)\` | Create a new entity. |
| \`update\` | \`(reqdata, ctrl) -> (any, err)\` | Update an existing entity. |
| \`remove\` | \`(reqmatch, ctrl) -> (any, err)\` | Remove an entity. |
| \`data_get\` | \`() -> dict\` | Get entity data. |
| \`data_set\` | \`(data)\` | Set entity data. |
| \`match_get\` | \`() -> dict\` | Get entity match criteria. |
| \`match_set\` | \`(match)\` | Set entity match criteria. |
| \`make\` | \`() -> Entity\` | Create a new instance with the same options. |
| \`get_name\` | \`() -> str\` | Return the entity name. |

### Result shape

Entity operations return \`(any, err)\`. The first value is a
\`dict\` with these keys:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`bool\` | \`True\` if the HTTP status is 2xx. |
| \`status\` | \`int\` | HTTP status code. |
| \`headers\` | \`dict\` | Response headers. |
| \`data\` | \`any\` | Parsed JSON response body. |

On error, \`ok\` is \`False\` and \`err\` contains the error value.

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
