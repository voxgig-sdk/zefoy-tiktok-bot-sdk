
import { cmp, each, Content, File, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(reqmatch, ctrl) -> any, err',
    returns: 'any, err',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'list(reqmatch, ctrl) -> any, err',
    returns: 'any, err',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'create(reqdata, ctrl) -> any, err',
    returns: 'any, err',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'update(reqdata, ctrl) -> any, err',
    returns: 'any, err',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'remove(reqmatch, ctrl) -> any, err',
    returns: 'any, err',
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

    Content(`\`\`\`lua
local sdk = require("${model.name}_sdk")
local client = sdk.new(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`table\` | SDK configuration options. |
| \`options.apikey\` | \`string\` | API key for authentication. |
| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`table\` | Custom headers for all requests. |
| \`options.feature\` | \`table\` | Feature configuration. |
| \`options.system\` | \`table\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`sdk.test(testopts, sdkopts)\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`lua
local client = sdk.test(nil, nil)
\`\`\`

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}(data)\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`)
    })


    Content(`#### \`options_map() -> table\`

Return a deep copy of the current SDK options.

#### \`get_utility() -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs) -> table, err\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs.path\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs.method\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs.params\` | \`table\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs.query\` | \`table\` | Query string parameters. |
| \`fetchargs.headers\` | \`table\` | Request headers (merged with defaults). |
| \`fetchargs.body\` | \`any\` | Request body (tables are JSON-serialized). |
| \`fetchargs.ctrl\` | \`table\` | Control options (e.g. \`{ explain = true }\`). |

**Returns:** \`table, err\`

#### \`prepare(fetchargs) -> table, err\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`.

**Returns:** \`table, err\`

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

      Content(`\`\`\`lua
local ${ent.name} = client:${ent.Name}(nil)
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
            Content(`\`\`\`lua
local result, err = client:${ent.Name}(nil):${opname}({ id = "${ent.name}_id" }, nil)
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`lua
local results, err = client:${ent.Name}(nil):list(nil, nil)
\`\`\`

`)
          }
          else if ('create' === opname) {
            Content(`\`\`\`lua
local result, err = client:${ent.Name}(nil):create({
`)
            each(fields, (field: any) => {
              if ('id' !== field.name && field.req) {
                Content(`  ${field.name} = --[[ ${field.type || 'value'} ]],
`)
              }
            })
            Content(`}, nil)
\`\`\`

`)
          }
          else if ('update' === opname) {
            Content(`\`\`\`lua
local result, err = client:${ent.Name}(nil):update({
  id = "${ent.name}_id",
  -- Fields to update
}, nil)
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`data_get() -> table\`

Get the entity data. Returns a copy of the current data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get() -> table\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make() -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`get_name() -> string\`

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

      Content(`\`\`\`lua
local client = sdk.new({
  feature = {
`)
      activeFeatures.map((f: any) => {
        Content(`    ${f.name} = { active = true },
`)
      })
      Content(`  },
})
\`\`\`

`)
    }

  })
})




export {
  ReadmeRef
}
