
import { cmp, each, Content, canonToType, File, isAuthActive, entityIdField, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(match: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'list(match: object, ctrl?: object)',
    returns: 'Promise<object[]>',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'create(data: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'update(data: object, ctrl?: object)',
    returns: 'Promise<object>',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'remove(match: object, ctrl?: object)',
    returns: 'Promise<void>',
    desc: 'Remove the entity matching the given criteria.',
  },
}


const ReadmeRef = cmp(function ReadmeRef(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const publishedEntities = each(entity).filter((e: any) => e.active !== false)


  File({ name: 'REFERENCE.md' }, () => {

    Content(`# ${model.Name} ${target.title} SDK Reference

Complete API reference for the ${model.Name} ${target.title} SDK.


## ${model.Name}SDK

### Constructor

`)

    Content(`\`\`\`ts
new ${model.Name}SDK(options?: object)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`object\` | SDK configuration options. |
${isAuthActive(model) ? '| \`options.apikey\` | \`string\` | API key for authentication. |\n' : ''}| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`object\` | Custom headers for all requests. |
| \`options.feature\` | \`object\` | Feature configuration. |
| \`options.system\` | \`object\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`${model.Name}SDK.test(testopts?, sdkopts?)\`

Create a test client with mock features active.

\`\`\`ts
const client = ${model.Name}SDK.test()
\`\`\`

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`testopts\` | \`object\` | Test feature options. |
| \`sdkopts\` | \`object\` | Additional SDK options merged with test defaults. |

**Returns:** \`${model.Name}SDK\` instance in test mode.

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}(data?: object)\`

Create a new \`${ent.Name}\` entity instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`data\` | \`object\` | Initial entity data. |

**Returns:** \`${ent.Name}Entity\` instance.

`)
    })


    Content(`#### \`options()\`

Return a deep copy of the current SDK options.

**Returns:** \`object\`

#### \`utility()\`

Return a copy of the SDK utility object.

**Returns:** \`object\`

#### \`direct(fetchargs?: object)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs.path\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs.method\` | \`string\` | HTTP method (default: \`GET\`). |
| \`fetchargs.params\` | \`object\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs.query\` | \`object\` | Query string parameters. |
| \`fetchargs.headers\` | \`object\` | Request headers (merged with defaults). |
| \`fetchargs.body\` | \`any\` | Request body (objects are JSON-serialized). |
| \`fetchargs.ctrl\` | \`object\` | Control options (e.g. \`{ explain: true }\`). |

**Returns:** \`Promise<{ ok, status, headers, data } | Error>\`

#### \`prepare(fetchargs?: object)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`Promise<{ url, method, headers, body } | Error>\`

#### \`tester(testopts?, sdkopts?)\`

Alias for \`${model.Name}SDK.test()\`.

**Returns:** \`${model.Name}SDK\` instance in test mode.

`)


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      const opnames = Object.keys(ent.op || {})
      const fields = ent.fields || []
      // Model-driven id key: null when this entity has no id-like field, in
      // which case load/remove match on no argument and update omits the id.
      const idF = entityIdField(ent)
      // Variable-safe lowercase name (a `Delete` entity must not bind `delete`).
      const eVar = safeVarName(ent.name, target.name)

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      Content(`\`\`\`ts
const ${eVar} = client.${ent.Name}()
\`\`\`

`)


      // Field schema
      if (fields.length > 0) {
        Content(`### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
`)
        each(fields, (field: any) => {
          const req = field.req ? 'Yes' : 'No'
          const desc = field.short || ''
          Content(`| \`${field.name}\` | \`${canonToType(field.type, target.name)}\` | ${req} | ${desc} |
`)
        })

        Content(`
`)

        // Field operations breakdown
        const hasFieldOps = fields.some((f: any) => f.op && Object.keys(f.op).length > 0)
        if (hasFieldOps) {
          // Only emit columns for operations this entity actually exposes —
          // never advertise a create/update/remove column the entity lacks.
          const opcols = ['load', 'list', 'create', 'update', 'remove']
            .filter((op: string) => opnames.includes(op) && ent.op[op]?.active !== false)
          Content(`### Field Usage by Operation

| Field | ${opcols.join(' | ')} |
| --- | ${opcols.map(() => '---').join(' | ')} |
`)
          each(fields, (field: any) => {
            const fops = field.op || {}
            const cols = opcols.map((op: string) => {
              const fop = fops[op]
              if (null == fop) return '-'
              if (fop.active === false) return '-'
              return 'Yes'
            })
            Content(`| \`${field.name}\` | ${cols.join(' | ')} |
`)
          })

          Content(`
`)
        }
      }


      // Operation details
      if (opnames.length > 0) {
        Content(`### Operations

`)

        opnames.map((opname: string) => {
          const info = OP_SIGNATURES[opname]
          if (!info) return

          Content(`#### \`${info.sig}\`

${info.desc}

`)

          // Show example
          if ('load' === opname || 'remove' === opname) {
            Content(`\`\`\`ts
const result = await client.${ent.Name}().${opname}(${idF ? `{ ${idF}: ${exampleValue(ent, ent.op && ent.op[opname], idF, ent.name + '_id')} }` : ''})
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`ts
const results = await client.${ent.Name}().${opname}()
\`\`\`

`)
          }
          else if ('create' === opname) {
            Content(`\`\`\`ts
const result = await client.${ent.Name}().create({
`)
            each(fields, (field: any) => {
              if ('id' !== field.name && field.req) {
                Content(`  ${field.name}: /* ${canonToType(field.type, target.name)} */,
`)
              }
            })
            Content(`})
\`\`\`

`)
          }
          else if ('update' === opname) {
            const updateIdLine = idF
              ? `  ${idF}: ${exampleValue(ent, ent.op && ent.op.update, idF, ent.name + '_id')},\n`
              : ''
            Content(`\`\`\`ts
const result = await client.${ent.Name}().update({
${updateIdLine}  // Fields to update
})
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`data(data?: object)\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`match(match?: object)\`

Get or set the entity match criteria. Works the same as \`data()\`.

#### \`make()\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`client()\`

Return the parent \`${model.Name}SDK\` instance.

#### \`entopts()\`

Return a copy of the entity options.

`)
    })


    // Features section
    const activeFeatures = each(feature).filter((f: any) => f.active)
    if (activeFeatures.length > 0) {
      Content(`
---

## Features

| Feature | Version | Description |
| --- | --- | --- |
`)

      activeFeatures.map((f: any) => {
        Content(`| \`${f.name}\` | ${f.version || '0.0.1'} | ${f.title || ''} |
`)
      })

      Content(`

Features are activated via the \`feature\` option:

`)

      Content(`\`\`\`ts
const client = new ${model.Name}SDK({
  feature: {
`)
      activeFeatures.map((f: any) => {
        Content(`    ${f.name}: { active: true },
`)
      })
      Content(`  }
})
\`\`\`

`)
    }

  })
})




export {
  ReadmeRef
}
