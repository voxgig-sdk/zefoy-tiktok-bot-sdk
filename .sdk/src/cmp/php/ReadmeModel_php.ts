
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
    ? '| `apikey` | `string` | API key for authentication. |\n'
    : ''

  Content(`### ${model.const.Name}SDK

\`\`\`php
require_once '${model.const.Name.toLowerCase()}_sdk.php';
$client = new ${model.const.Name}SDK($options);
\`\`\`

Creates a new SDK client.

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`array\` | Feature activation flags. |
| \`extend\` | \`array\` | Additional Feature instances to load. |
| \`system\` | \`array\` | System overrides (e.g. custom \`fetch\` callable). |

### test

\`\`\`php
$client = ${model.const.Name}SDK::test($testopts, $sdkopts);
\`\`\`

Creates a test-mode client with mock transport. Both arguments may be \`null\`.

### ${model.const.Name}SDK methods

| Method | Signature | Description |
| --- | --- | --- |
| \`options_map\` | \`(): array\` | Deep copy of current SDK options. |
| \`get_utility\` | \`(): Utility\` | Copy of the SDK utility object. |
| \`prepare\` | \`(array $fetchargs): array\` | Build an HTTP request definition without sending. |
| \`direct\` | \`(array $fetchargs): array\` | Build and send an HTTP request. |
`)

  each(entityList, (ent: any) => {
    Content(`| \`${ent.Name}\` | \`($data): ${ent.Name}Entity\` | Create a ${ent.Name} entity instance. |
`)
  })

  Content(`
### Entity interface

All entities share the same interface.

| Method | Signature | Description |
| --- | --- | --- |
| \`load\` | \`($reqmatch, $ctrl): array\` | Load a single entity by match criteria. |
| \`list\` | \`($reqmatch, $ctrl): array\` | List entities matching the criteria. |
| \`create\` | \`($reqdata, $ctrl): array\` | Create a new entity. |
| \`update\` | \`($reqdata, $ctrl): array\` | Update an existing entity. |
| \`remove\` | \`($reqmatch, $ctrl): array\` | Remove an entity. |
| \`data_get\` | \`(): array\` | Get entity data. |
| \`data_set\` | \`($data): void\` | Set entity data. |
| \`match_get\` | \`(): array\` | Get entity match criteria. |
| \`match_set\` | \`($match): void\` | Set entity match criteria. |
| \`make\` | \`(): Entity\` | Create a new instance with the same options. |
| \`get_name\` | \`(): string\` | Return the entity name. |

### Result shape

Entity operations return \`[$result, $err]\`. The first value is an
\`array\` with these keys:

| Key | Type | Description |
| --- | --- | --- |
| \`ok\` | \`bool\` | \`true\` if the HTTP status is 2xx. |
| \`status\` | \`int\` | HTTP status code. |
| \`headers\` | \`array\` | Response headers. |
| \`data\` | \`mixed\` | Parsed JSON response body. |

On error, \`ok\` is \`false\` and \`$err\` contains the error value.

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
