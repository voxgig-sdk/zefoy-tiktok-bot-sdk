
import { cmp, each, Content, canonToType, canonKey, File, isAuthActive, entityIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// A type-correct, JSON-serialisable Python literal — never an Ellipsis (`...`),
// which is not JSON-serialisable when a create body is executed by the doc test.
function pyLit(type: any): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'True'
  if ('ARRAY' === k) return '[]'
  if ('OBJECT' === k) return '{}'
  return '"example"'
}


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(reqmatch, ctrl=None) -> dict',
    returns: 'the entity data',
    desc: 'Load a single entity matching the given criteria. Returns the entity data and raises on error.',
  },
  list: {
    sig: 'list(reqmatch=None, ctrl=None) -> list',
    returns: 'a list of entities',
    desc: 'List entities matching the given criteria. The match is optional — call `list()` with no argument to list all records. Returns a list and raises on error.',
  },
  create: {
    sig: 'create(reqdata, ctrl=None) -> dict',
    returns: 'the created entity data',
    desc: 'Create a new entity with the given data. Returns the created entity data and raises on error.',
  },
  update: {
    sig: 'update(reqdata, ctrl=None) -> dict',
    returns: 'the updated entity data',
    desc: 'Update an existing entity. The data must include the entity `id`. Returns the updated entity data and raises on error.',
  },
  remove: {
    sig: 'remove(reqmatch, ctrl=None) -> dict',
    returns: 'the removed entity data',
    desc: 'Remove the entity matching the given criteria. Raises on error.',
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

    Content(`\`\`\`python
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`dict\` | SDK configuration options. |
${isAuthActive(model) ? '| \`options["apikey"]\` | \`str\` | API key for authentication. |\n' : ''}| \`options["base"]\` | \`str\` | Base URL for API requests. |
| \`options["prefix"]\` | \`str\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`str\` | URL suffix appended after path. |
| \`options["headers"]\` | \`dict\` | Custom headers for all requests. |
| \`options["feature"]\` | \`dict\` | Feature configuration. |
| \`options["system"]\` | \`dict\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`${model.const.Name}SDK.test(testopts=None, sdkopts=None)\`

Create a test client with mock features active. Both arguments may be \`None\`.

\`\`\`python
client = ${model.const.Name}SDK.test()
\`\`\`

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}(data=None)\`

Create a new \`${ent.Name}Entity\` instance. Pass \`None\` for no initial data.

`)
    })


    Content(`#### \`options_map() -> dict\`

Return a deep copy of the current SDK options.

#### \`get_utility() -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs=None) -> dict\`

Make a direct HTTP request to any API endpoint. Returns a result \`dict\` with \`ok\`, \`status\`, \`headers\`, and \`data\` (or \`err\` on failure). This escape hatch never raises — branch on \`result["ok"]\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`str\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`str\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`dict\` | Path parameter values. |
| \`fetchargs["query"]\` | \`dict\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`dict\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (dicts are JSON-serialized). |

**Returns:** \`result_dict\`

#### \`prepare(fetchargs=None) -> dict\`

Prepare a fetch definition without sending. Returns the \`fetchdef\` and raises on error.

`)


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      const opnames = Object.keys(ent.op || {})
      const fields = ent.fields || []
      // Model-driven id key: null when this entity has no id-like field, in
      // which case load/remove match on no argument and update omits the id.
      const idF = entityIdField(ent)

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      Content(`\`\`\`python
${ent.name} = client.${ent.Name}()
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

          // Show example. Entity ops return the bare result and raise on
          // error; direct() is the only method that returns a result dict.
          if ('load' === opname || 'remove' === opname) {
            Content(`\`\`\`python
result = client.${ent.Name}().${opname}(${idF ? `{"${idF}": "${ent.name}_id"}` : ''})
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`python
results = client.${ent.Name}().list()
for ${ent.name} in results:
    print(${ent.name})
\`\`\`

`)
          }
          else if ('create' === opname) {
            Content(`\`\`\`python
result = client.${ent.Name}().create({
`)
            each(fields, (field: any) => {
              if ('id' !== field.name && field.req) {
                Content(`    "${field.name}": ${pyLit(field.type)},  # ${canonToType(field.type, target.name)}
`)
              }
            })
            Content(`})
\`\`\`

`)
          }
          else if ('update' === opname) {
            const updateIdLine = idF ? `    "${idF}": "${ent.name}_id",\n` : ''
            Content(`\`\`\`python
result = client.${ent.Name}().update({
${updateIdLine}    # Fields to update
})
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`data_get() -> dict\`

Get the entity data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get() -> dict\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make() -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same options.

#### \`get_name() -> str\`

Return the entity name.

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

      Content(`\`\`\`python
client = ${model.const.Name}SDK({
    "feature": {
`)
      activeFeatures.map((f: any) => {
        Content(`        "${f.name}": {"active": True},
`)
      })
      Content(`    },
})
\`\`\`

`)
    }

  })
})




export {
  ReadmeRef
}
