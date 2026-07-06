
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
    load: '| `load` | `load(reqmatch?, ctrl?): Promise<Entity>` | Load a single entity by match criteria. |',
    list: '| `list` | `list(reqmatch?, ctrl?): Promise<Entity[]>` | List entities matching the criteria. |',
    create: '| `create` | `create(reqdata?, ctrl?): Promise<Entity>` | Create a new entity. |',
    update: '| `update` | `update(reqdata?, ctrl?): Promise<Entity>` | Update an existing entity. |',
    remove: '| `remove` | `remove(reqmatch?, ctrl?): Promise<void>` | Remove an entity. |',
  }
  const opRows = ['load', 'list', 'create', 'update', 'remove']
    .filter((o) => opUnion.has(o)).map((o) => opRowDefs[o]).join('\n')

  // Model-driven return-value bullets: describe only the operations that
  // actually exist (single-object ops among load/create/update, plus
  // list/remove) — never document return semantics for a missing op.
  const singleOps = ['load', 'create', 'update'].filter((o) => opUnion.has(o))
    .map((o) => '`' + o + '`')
  const retBullets: string[] = []
  if (singleOps.length) {
    const joined = singleOps.length > 1
      ? singleOps.slice(0, -1).join(', ') + ' and ' + singleOps[singleOps.length - 1]
      : singleOps[0]
    retBullets.push(`- ${joined} ${singleOps.length > 1 ? 'resolve' : 'resolves'} to a single entity object.`)
  }
  if (opUnion.has('list')) {
    retBullets.push('- `list` resolves to an **array** of entity objects (iterate it directly;\n  there is no `.data` and no `.ok`).')
  }
  if (opUnion.has('remove')) {
    retBullets.push('- `remove` resolves to `void`.')
  }
  const returnBullets = retBullets.join('\n')

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
    const article = /^[aeiou]/i.test(ent.Name) ? 'an' : 'a'
    Content(`| \`${ent.Name}(data?)\` | \`${ent.Name}Entity\` | Create ${article} ${ent.Name} entity instance. |
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
${opRows}
| \`data\` | \`data(data?: Partial<Entity>): Entity\` | Get or set entity data. |
| \`match\` | \`match(match?: Partial<Entity>): Partial<Entity>\` | Get or set entity match criteria. |
| \`make\` | \`make(): Entity\` | Create a new instance with the same options. |
| \`client\` | \`client(): ${model.const.Name}SDK\` | Return the parent SDK client. |
| \`entopts\` | \`entopts(): object\` | Return a copy of the entity options. |

#### Return values

Entity operations resolve to the entity data directly — there is no
result envelope:

${returnBullets}

On a failed request these methods **throw**, so wrap calls in
\`try\`/\`catch\` to handle errors. Only \`direct()\` returns the result
envelope described below.

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
