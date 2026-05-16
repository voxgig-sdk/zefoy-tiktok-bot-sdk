
import { cmp, each, Content, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const ReadmeModel = cmp(function ReadmeModel(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const entityList = each(entity).filter((e: any) => e.active !== false)

  const authActive = isAuthActive(model)
  const apikeyOptionType = authActive ? `\n  apikey?: string` : ''
  const apikeyOptionRow = authActive
    ? '| `apikey` | `string` | API key for authentication. |\n'
    : ''

  Content(`### ${model.const.Name}SDK

#### Constructor

\`\`\`ts
new ${model.const.Name}SDK(options?: {${apikeyOptionType}
  base?: string
  prefix?: string
  suffix?: string
  feature?: Record<string, { active: boolean }>
  extend?: Feature[]
})
\`\`\`

| Option | Type | Description |
| --- | --- | --- |
${apikeyOptionRow}| \`base\` | \`string\` | Base URL of the API server. |
| \`prefix\` | \`string\` | URL path prefix prepended to all requests. |
| \`suffix\` | \`string\` | URL path suffix appended to all requests. |
| \`feature\` | \`object\` | Feature activation flags (e.g. \`{ test: { active: true } }\`). |
| \`extend\` | \`Feature[]\` | Additional feature instances to load. |

#### Methods

| Method | Returns | Description |
| --- | --- | --- |
| \`options()\` | \`object\` | Deep copy of current SDK options. |
| \`utility()\` | \`Utility\` | Deep copy of the SDK utility object. |
| \`prepare(fetchargs?)\` | \`Promise<FetchDef>\` | Build an HTTP request definition without sending it. |
| \`direct(fetchargs?)\` | \`Promise<DirectResult>\` | Build and send an HTTP request. |
`)

  each(entityList, (ent: any) => {
    Content(`| \`${ent.Name}(data?)\` | \`${ent.Name}Entity\` | Create a ${ent.Name} entity instance. |
`)
  })

  Content(`| \`tester(testopts?, sdkopts?)\` | \`${model.const.Name}SDK\` | Create a test-mode client instance. |

#### Static methods

| Method | Returns | Description |
| --- | --- | --- |
| \`${model.const.Name}SDK.test(testopts?, sdkopts?)\` | \`${model.const.Name}SDK\` | Create a test-mode client. |

### Entity interface

All entities share the same interface.

#### Methods

| Method | Signature | Description |
| --- | --- | --- |
| \`load\` | \`load(reqmatch?, ctrl?): Promise<Result>\` | Load a single entity by match criteria. |
| \`list\` | \`list(reqmatch?, ctrl?): Promise<Result>\` | List entities matching the criteria. |
| \`create\` | \`create(reqdata?, ctrl?): Promise<Result>\` | Create a new entity. |
| \`update\` | \`update(reqdata?, ctrl?): Promise<Result>\` | Update an existing entity. |
| \`remove\` | \`remove(reqmatch?, ctrl?): Promise<Result>\` | Remove an entity. |
| \`data\` | \`data(data?): any\` | Get or set entity data. |
| \`match\` | \`match(match?): any\` | Get or set entity match criteria. |
| \`make\` | \`make(): Entity\` | Create a new instance with the same options. |
| \`client\` | \`client(): ${model.const.Name}SDK\` | Return the parent SDK client. |
| \`entopts\` | \`entopts(): object\` | Return a copy of the entity options. |

#### Result shape

All entity operations return a Result object:

\`\`\`ts
{
  ok: boolean      // true if the HTTP status is 2xx
  status: number   // HTTP status code
  headers: object  // response headers
  data: any        // parsed JSON response body
}
\`\`\`

### DirectResult shape

The \`direct()\` method returns:

\`\`\`ts
{
  ok: boolean
  status: number
  headers: object
  data: any
}
\`\`\`

On error, \`ok\` is \`false\` and an \`err\` property contains the error.

### FetchDef shape

The \`prepare()\` method returns:

\`\`\`ts
{
  url: string
  method: string
  headers: Record<string, string>
  body?: any
}
\`\`\`

### Entities

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
Operations: ${opnames.join(', ')}.

API path: \`${path}\`

`)
  })

})


export {
  ReadmeModel
}
