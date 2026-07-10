
import { cmp, each, Content, canonToType, canonKey, File, isAuthActive, entityIdField, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// A type-correct Ruby literal for a field's canonical type — the create body
// is EXECUTED by the doc test, so it must carry a real value per field.
// Strings render the quoted placeholder.
function rbLit(type: any, placeholder: string = 'example'): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k) return '[]'
  if ('OBJECT' === k) return '{}'
  return `"${placeholder}"`
}


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(reqmatch, ctrl = nil) -> result',
    returns: 'result',
    desc: 'Load a single entity matching the given criteria. Raises on error.',
  },
  list: {
    sig: 'list(reqmatch = nil, ctrl = nil) -> Array',
    returns: 'Array',
    desc: 'List entities matching the given criteria (call with no argument to list all). Returns an array. Raises on error.',
  },
  create: {
    sig: 'create(reqdata, ctrl = nil) -> result',
    returns: 'result',
    desc: 'Create a new entity with the given data. Raises on error.',
  },
  update: {
    sig: 'update(reqdata, ctrl = nil) -> result',
    returns: 'result',
    desc: 'Update an existing entity. The data must include the entity `id`. Raises on error.',
  },
  remove: {
    sig: 'remove(reqmatch, ctrl = nil) -> result',
    returns: 'result',
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

    Content(`\`\`\`ruby
require_relative '${model.const.Name}_sdk'

client = ${model.const.Name}SDK.new(options)
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`Hash\` | SDK configuration options. |
${isAuthActive(model) ? '| \`options["apikey"]\` | \`String\` | API key for authentication. |\n' : ''}| \`options["base"]\` | \`String\` | Base URL for API requests. |
| \`options["prefix"]\` | \`String\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`String\` | URL suffix appended after path. |
| \`options["headers"]\` | \`Hash\` | Custom headers for all requests. |
| \`options["feature"]\` | \`Hash\` | Feature configuration. |
| \`options["system"]\` | \`Hash\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`${model.const.Name}SDK.test(testopts = nil, sdkopts = nil)\`

Create a test client with mock features active. Both arguments may be \`nil\`.

\`\`\`ruby
client = ${model.const.Name}SDK.test
\`\`\`

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}(data = nil)\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`)
    })


    Content(`#### \`options_map -> Hash\`

Return a deep copy of the current SDK options.

#### \`get_utility -> Utility\`

Return a copy of the SDK utility object.

#### \`direct(fetchargs = {}) -> Hash\`

Make a direct HTTP request to any API endpoint. Returns a result hash
(\`{ "ok" => ..., "status" => ..., "data" => ..., "err" => ... }\`); it
does not raise — inspect \`result["ok"]\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`String\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`String\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`Hash\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs["query"]\` | \`Hash\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`Hash\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (hashes are JSON-serialized). |
| \`fetchargs["ctrl"]\` | \`Hash\` | Control options (e.g. \`{ "explain" => true }\`). |

**Returns:** \`Hash\`

#### \`prepare(fetchargs = {}) -> Hash\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`direct()\`. Raises on error.

**Returns:** \`Hash\` (the fetch definition; raises on error)

`)


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      const opnames = Object.keys(ent.op || {})
      const fields = ent.fields || []
      // Model-driven id key: null when this entity has no id-like field, in
      // which case load/remove match on no argument and update omits the id.
      const idF = entityIdField(ent)
      // Sanitise the local variable name — an entity whose lowercased name is
      // a Ruby keyword (e.g. `self`) would otherwise emit uncompilable code.
      const eVar = safeVarName(ent.name, 'rb')

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      Content(`\`\`\`ruby
${eVar} = client.${ent.Name}
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
                `"${it.name}" => ${rbLit(it.type,
                  it.name === idF ? ent.name + '_id' : it.name)}`).join(', ')} }`
              : ''
            Content(`\`\`\`ruby
result = client.${ent.Name}.${opname}(${arg})
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`ruby
results = client.${ent.Name}.list
\`\`\`

`)
          }
          else if ('create' === opname) {
            // Members come from the SAME shape the runtime validates
            // (opRequestShape): every required member must appear — including
            // a required id and parent keys like page_id — with a real,
            // executable literal (the doc test RUNS this block, so a comment
            // placeholder would break it).
            const createItems = opRequestShape(ent, 'create').items
              .filter((it: any) => !it.optional)
            Content(`\`\`\`ruby
result = client.${ent.Name}.create({
`)
            createItems.map((it: any) => {
              Content(`  "${it.name}" => ${rbLit(it.type, 'example_' + it.name)}, # ${canonToType(it.type, target.name)}
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
              `  "${it.name}" => ${rbLit(it.type,
                it.name === idF ? ent.name + '_id' : it.name)},\n`).join('')
            Content(`\`\`\`ruby
result = client.${ent.Name}.update({
${updateLines}  # Fields to update
})
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`data_get -> Hash\`

Get the entity data. Returns a copy of the current data.

#### \`data_set(data)\`

Set the entity data.

#### \`match_get -> Hash\`

Get the entity match criteria.

#### \`match_set(match)\`

Set the entity match criteria.

#### \`make -> Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`get_name -> String\`

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

      Content(`\`\`\`ruby
client = ${model.const.Name}SDK.new({
  "feature" => {
`)
      activeFeatures.map((f: any) => {
        Content(`    "${f.name}" => { "active" => true },
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
