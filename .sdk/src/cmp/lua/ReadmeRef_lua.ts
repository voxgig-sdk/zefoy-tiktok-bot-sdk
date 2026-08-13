
import { cmp, each, Content, canonToType, canonKey, File, isAuthActive, entityIdField, opRequestShape, safeVarName, exampleVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// A type-correct, executable Lua literal for a param: numeric/boolean/table
// params render a typed literal; strings render the quoted placeholder (the
// doc test EXECUTES runnable blocks, so a comment placeholder would not
// parse).
function luaLit(type: any, placeholder: string = 'example'): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '{}'
  return `"${placeholder}"`
}

// Non-identifier table keys use bracket syntax.
function luaKey(name: string): string {
  return /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
}


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
${isAuthActive(model) ? '| \`options.apikey\` | \`string\` | API key for authentication. |\n' : ''}| \`options.base\` | \`string\` | Base URL for API requests. |
| \`options.prefix\` | \`string\` | URL prefix appended after base. |
| \`options.suffix\` | \`string\` | URL suffix appended after path. |
| \`options.headers\` | \`table\` | Custom headers for all requests. |
| \`options.feature\` | \`table\` | Feature configuration. |
| \`options.system\` | \`table\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`sdk.test(testopts?, sdkopts?)\`

Create a test client with mock features active. Both arguments are optional.

\`\`\`lua
local client = sdk.test()
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
      // Model-driven id key: null when this entity has no id-like field, in
      // which case load/remove match on no argument and update omits the id.
      const idF = entityIdField(ent)
      // Sanitise the local variable name — an entity whose lowercased name is
      // a Lua keyword (e.g. `end`) would otherwise emit uncompilable code.
      const eVar = exampleVarName(ent.name, 'lua')

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      Content(`\`\`\`lua
local ${eVar} = client:${ent.Name}(nil)
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
            // The id key plus every REQUIRED match key (parent path params
            // like page_id) — the same shape the runtime resolves path
            // params from, so the example always works.
            const matchItems = opRequestShape(ent, opname).items
              .filter((it: any) => !it.optional || it.name === idF)
              .sort((a: any, b: any) =>
                (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
            const arg = 0 < matchItems.length
              ? `{ ${matchItems.map((it: any) =>
                `${luaKey(it.name)} = ${luaLit(it.type,
                  it.name === idF ? ent.name + '_id' : it.name)}`).join(', ')} }`
              : ''
            Content(`\`\`\`lua
local result, err = client:${ent.Name}():${opname}(${arg})
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`lua
local results, err = client:${ent.Name}():list()
\`\`\`

`)
          }
          else if ('create' === opname) {
            // Members come from the SAME shape the runtime validates
            // (opRequestShape): every required member must appear — including
            // a required id and parent keys like page_id (the --[[ type ]]
            // placeholders mark the block as an illustration for the doc
            // gate).
            const createItems = opRequestShape(ent, 'create').items
              .filter((it: any) => !it.optional)
            Content(`\`\`\`lua
local result, err = client:${ent.Name}():create({
`)
            createItems.map((it: any) => {
              Content(`  ${luaKey(it.name)} = --[[ ${canonToType(it.type, target.name)} ]],
`)
            })
            Content(`})
\`\`\`

`)
          }
          else if ('update' === opname) {
            // The id key plus every REQUIRED data member — the same shape the
            // runtime validates — then the patch-fields note.
            const updateItems = opRequestShape(ent, 'update').items
              .filter((it: any) => !it.optional || it.name === idF)
              .sort((a: any, b: any) =>
                (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
            const updateLines = updateItems.map((it: any) =>
              `  ${luaKey(it.name)} = ${luaLit(it.type,
                it.name === idF ? ent.name + '_id' : it.name)},\n`).join('')
            Content(`\`\`\`lua
local result, err = client:${ent.Name}():update({
${updateLines}  -- Fields to update
})
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
