
import { cmp, each, Content, canonToType, File, isAuthActive, entityIdField, entityOps, opRequestShape } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import { exampleValue, goVarName } from './utility_go'


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'Load(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'List(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'Create(reqdata, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'Update(reqdata, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'Remove(reqmatch, ctrl map[string]any) (any, error)',
    returns: '(any, error)',
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

    Content(`\`\`\`go
func New${model.const.Name}SDK(options map[string]any) *${model.const.Name}SDK
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`options\` | \`map[string]any\` | SDK configuration options. |
${isAuthActive(model) ? '| \`options["apikey"]\` | \`string\` | API key for authentication. |\n' : ''}| \`options["base"]\` | \`string\` | Base URL for API requests. |
| \`options["prefix"]\` | \`string\` | URL prefix appended after base. |
| \`options["suffix"]\` | \`string\` | URL suffix appended after path. |
| \`options["headers"]\` | \`map[string]any\` | Custom headers for all requests. |
| \`options["feature"]\` | \`map[string]any\` | Feature configuration. |
| \`options["system"]\` | \`map[string]any\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`Test() *${model.const.Name}SDK\`

No-arg convenience constructor for the common no-options test case.

\`\`\`go
client := sdk.Test()
\`\`\`

#### \`TestSDK(testopts, sdkopts map[string]any) *${model.const.Name}SDK\`

Test client with options. Both arguments may be \`nil\`.

\`\`\`go
client := sdk.TestSDK(testopts, sdkopts)
\`\`\`

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}(data map[string]any) ${model.const.Name}Entity\`

Create a new \`${ent.Name}\` entity instance. Pass \`nil\` for no initial data.

`)
    })


    Content(`#### \`OptionsMap() map[string]any\`

Return a deep copy of the current SDK options.

#### \`GetUtility() *Utility\`

Return a copy of the SDK utility object.

#### \`Direct(fetchargs map[string]any) (map[string]any, error)\`

Make a direct HTTP request to any API endpoint.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`fetchargs["path"]\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`fetchargs["method"]\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`fetchargs["params"]\` | \`map[string]any\` | Path parameter values for \`{param}\` substitution. |
| \`fetchargs["query"]\` | \`map[string]any\` | Query string parameters. |
| \`fetchargs["headers"]\` | \`map[string]any\` | Request headers (merged with defaults). |
| \`fetchargs["body"]\` | \`any\` | Request body (maps are JSON-serialized). |
| \`fetchargs["ctrl"]\` | \`map[string]any\` | Control options (e.g. \`map[string]any{"explain": true}\`). |

**Returns:** \`(map[string]any, error)\`

#### \`Prepare(fetchargs map[string]any) (map[string]any, error)\`

Prepare a fetch definition without sending the request. Accepts the
same parameters as \`Direct()\`.

**Returns:** \`(map[string]any, error)\`

`)


    // Entity reference sections
    publishedEntities.map((ent: any) => {
      // ACTIVE ops only — an inactive op generates no method, so an example
      // calling it would not compile.
      const opnames = entityOps(ent)
      const fields = ent.fields || []
      // Model-driven id key: null when this entity has no id-like field, in
      // which case load/remove pass a nil match and update omits the id.
      const idF = entityIdField(ent)
      // camelCase Go identifier (a `status_embed_config` entity must not bind
      // a snake_case Go variable).
      const eVar = goVarName(ent.name)

      Content(`
---

## ${ent.Name}Entity

`)

      if (ent.short) {
        Content(`${ent.short}

`)
      }

      Content(`\`\`\`go
${eVar} := client.${ent.Name}(nil)
fmt.Println(${eVar}.GetName()) // "${ent.name}"
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
          // never advertise a create/update/remove column the entity lacks
          // (opnames already carries active ops only).
          const opcols = ['load', 'list', 'create', 'update', 'remove']
            .filter((op: string) => opnames.includes(op))
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

          // Show example. Every compiled example is self-consuming — check
          // `err` and print the result — so the doc gate builds it without
          // unused-variable repairs, and readers see the idiomatic pattern.
          if ('load' === opname || 'remove' === opname) {
            const goOpName = opname.charAt(0).toUpperCase() + opname.slice(1)
            // The id key plus every REQUIRED match key (parent path params
            // like page_id) — the same shape that generates the op's request
            // match, so the example always carries the keys the route needs.
            const matchItems = opRequestShape(ent, opname).items
              .filter((it: any) => !it.optional || it.name === idF)
              .sort((a: any, b: any) =>
                (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
            const arg = 0 < matchItems.length
              ? `map[string]any{${matchItems.map((it: any) =>
                `"${it.name}": ${exampleValue(ent, ent.op && ent.op[opname], it.name,
                  it.name === idF ? ent.name + '_id' : it.name)}`).join(', ')}}`
              : 'nil'
            Content(`\`\`\`go
result, err := client.${ent.Name}(nil).${goOpName}(${arg}, nil)
if err != nil {
    panic(err)
}
fmt.Println(result)
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`go
results, err := client.${ent.Name}(nil).List(nil, nil)
if err != nil {
    panic(err)
}
fmt.Println(results)
\`\`\`

`)
          }
          else if ('create' === opname) {
            // Members come from the SAME shape that generates the op's
            // request data (every required member appears, including a
            // required id), each with a type-correct example VALUE via
            // exampleValue — a `"name": /* type */` comment is not a value
            // and yields uncompilable Go.
            const createItems = opRequestShape(ent, 'create').items
              .filter((it: any) => !it.optional)
            Content(`\`\`\`go
result, err := client.${ent.Name}(nil).Create(map[string]any{
`)
            createItems.map((it: any) => {
              Content(`    "${it.name}": ${exampleValue(ent, ent.op && ent.op.create, it.name, 'example_' + it.name)},
`)
            })
            Content(`}, nil)
if err != nil {
    panic(err)
}
fmt.Println(result)
\`\`\`

`)
          }
          else if ('update' === opname) {
            // The id key plus every REQUIRED data member — the same shape
            // that generates the op's request data — then the patch-fields
            // note.
            const updateItems = opRequestShape(ent, 'update').items
              .filter((it: any) => !it.optional || it.name === idF)
              .sort((a: any, b: any) =>
                (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
            const updateLines = updateItems.map((it: any) =>
              `    "${it.name}": ${exampleValue(ent, ent.op && ent.op.update, it.name,
                it.name === idF ? ent.name + '_id' : it.name)},\n`).join('')
            Content(`\`\`\`go
result, err := client.${ent.Name}(nil).Update(map[string]any{
${updateLines}    // Fields to update
}, nil)
if err != nil {
    panic(err)
}
fmt.Println(result)
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`Data(args ...any) any\`

Get or set the entity data. When called with data, sets the entity's
internal data and returns the current data. When called without
arguments, returns a copy of the current data.

#### \`Match(args ...any) any\`

Get or set the entity match criteria. Works the same as \`Data()\`.

#### \`Make() Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`GetName() string\`

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

      Content(`\`\`\`go
client := sdk.New${model.const.Name}SDK(map[string]any{
    "feature": map[string]any{
`)
      activeFeatures.map((f: any) => {
        Content(`        "${f.name}": map[string]any{"active": true},
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
