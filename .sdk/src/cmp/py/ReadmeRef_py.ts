
import { cmp, each, Content, File, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(reqmatch, ctrl=None) -> tuple',
    returns: '(result, err)',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'list(reqmatch, ctrl=None) -> tuple',
    returns: '(result, err)',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'create(reqdata, ctrl=None) -> tuple',
    returns: '(result, err)',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'update(reqdata, ctrl=None) -> tuple',
    returns: '(result, err)',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'remove(reqmatch, ctrl=None) -> tuple',
    returns: '(result, err)',
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

    Content(`\`\`\`python
from ${model.name}_sdk import ${model.const.Name}SDK

client = ${model.const.Name}SDK(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`dict\` | SDK configuration options. |
| \`options["apikey"]\` | \`str\` | API key for authentication. |
| \`options["base"]\` | \`str\` | Base URL for API requests. |
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

#### \`direct(fetchargs=None) -> tuple\`

Make a direct HTTP request to any API endpoint. Returns \`(result, err)\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`str\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`str\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`dict\` | Path parameter values. |
| \`fetchargs["query"]\` | \`dict\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`dict\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (dicts are JSON-serialized). |

**Returns:** \`(result_dict, err)\`

#### \`prepare(fetchargs=None) -> tuple\`

Prepare a fetch definition without sending. Returns \`(fetchdef, err)\`.

`)


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      const opnames = Object.keys(ent.op || {})
      const fields = ent.fields || []

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
          Content(`| \`${field.name}\` | \`${field.type || 'any'}\` | ${req} | ${desc} |
`)
        })

        Content(`
`)

        // Field operations breakdown
        const hasFieldOps = fields.some((f: any) => f.op && Object.keys(f.op).length > 0)
        if (hasFieldOps) {
          Content(`### Field Usage by Operation

| Field | load | list | create | update | remove |
| --- | --- | --- | --- | --- | --- |
`)
          each(fields, (field: any) => {
            const fops = field.op || {}
            const cols = ['load', 'list', 'create', 'update', 'remove'].map((op: string) => {
              if (!opnames.includes(op)) return '-'
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
            Content(`\`\`\`python
result, err = client.${ent.Name}().${opname}({"id": "${ent.name}_id"})
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`python
results, err = client.${ent.Name}().list({})
\`\`\`

`)
          }
          else if ('create' === opname) {
            Content(`\`\`\`python
result, err = client.${ent.Name}().create({
`)
            each(fields, (field: any) => {
              if ('id' !== field.name && field.req) {
                Content(`    "${field.name}": # ${field.type || 'value'},
`)
              }
            })
            Content(`})
\`\`\`

`)
          }
          else if ('update' === opname) {
            Content(`\`\`\`python
result, err = client.${ent.Name}().update({
    "id": "${ent.name}_id",
    # Fields to update
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
