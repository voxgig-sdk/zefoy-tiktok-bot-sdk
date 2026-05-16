
import { cmp, each, Content, File, isAuthActive } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const OP_SIGNATURES: Record<string, { sig: string, returns: string, desc: string }> = {
  load: {
    sig: 'load(array $reqmatch, ?array $ctrl = null): array',
    returns: 'array [$result, $err]',
    desc: 'Load a single entity matching the given criteria.',
  },
  list: {
    sig: 'list(array $reqmatch, ?array $ctrl = null): array',
    returns: 'array [$result, $err]',
    desc: 'List entities matching the given criteria. Returns an array.',
  },
  create: {
    sig: 'create(array $reqdata, ?array $ctrl = null): array',
    returns: 'array [$result, $err]',
    desc: 'Create a new entity with the given data.',
  },
  update: {
    sig: 'update(array $reqdata, ?array $ctrl = null): array',
    returns: 'array [$result, $err]',
    desc: 'Update an existing entity. The data must include the entity `id`.',
  },
  remove: {
    sig: 'remove(array $reqmatch, ?array $ctrl = null): array',
    returns: 'array [$result, $err]',
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

    Content(`\`\`\`php
require_once __DIR__ . '/${model.name}_sdk.php';

$client = new ${model.const.Name}SDK($options);
\`\`\`

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`$options\` | \`array\` | SDK configuration options. |
| \`$options["apikey"]\` | \`string\` | API key for authentication. |
| \`$options["base"]\` | \`string\` | Base URL for API requests. |
| \`$options["prefix"]\` | \`string\` | URL prefix appended after base. |
| \`$options["suffix"]\` | \`string\` | URL suffix appended after path. |
| \`$options["headers"]\` | \`array\` | Custom headers for all requests. |
| \`$options["feature"]\` | \`array\` | Feature configuration. |
| \`$options["system"]\` | \`array\` | System overrides (e.g. custom fetch). |

`)


    Content(`
### Static Methods

`)

    Content(`#### \`${model.const.Name}SDK::test($testopts = null, $sdkopts = null)\`

Create a test client with mock features active. Both arguments may be \`null\`.

\`\`\`php
$client = ${model.const.Name}SDK::test();
\`\`\`

`)


    Content(`
### Instance Methods

`)


    // Entity factory methods
    publishedEntities.map((ent: any) => {
      Content(`#### \`${ent.Name}($data = null)\`

Create a new \`${ent.Name}Entity\` instance. Pass \`null\` for no initial data.

`)
    })


    Content(`#### \`optionsMap(): array\`

Return a deep copy of the current SDK options.

#### \`getUtility(): ProjectNameUtility\`

Return a copy of the SDK utility object.

#### \`direct(array $fetchargs = []): array\`

Make a direct HTTP request to any API endpoint. Returns \`[$result, $err]\`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| \`$fetchargs["path"]\` | \`string\` | URL path with optional \`{param}\` placeholders. |
| \`$fetchargs["method"]\` | \`string\` | HTTP method (default: \`"GET"\`). |
| \`$fetchargs["params"]\` | \`array\` | Path parameter values for \`{param}\` substitution. |
| \`$fetchargs["query"]\` | \`array\` | Query string parameters. |
| \`$fetchargs["headers"]\` | \`array\` | Request headers (merged with defaults). |
| \`$fetchargs["body"]\` | \`mixed\` | Request body (arrays are JSON-serialized). |
| \`$fetchargs["ctrl"]\` | \`array\` | Control options. |

**Returns:** \`array [$result, $err]\`

#### \`prepare(array $fetchargs = []): array\`

Prepare a fetch definition without sending the request. Returns \`[$fetchdef, $err]\`.

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

      Content(`\`\`\`php
$${ent.name} = $client->${ent.Name}();
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
            Content(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->${opname}(["id" => "${ent.name}_id"]);
\`\`\`

`)
          }
          else if ('list' === opname) {
            Content(`\`\`\`php
[$results, $err] = $client->${ent.Name}()->list([]);
\`\`\`

`)
          }
          else if ('create' === opname) {
            Content(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->create([
`)
            each(fields, (field: any) => {
              if ('id' !== field.name && field.req) {
                Content(`  "${field.name}" => /* ${field.type || 'value'} */,
`)
              }
            })
            Content(`]);
\`\`\`

`)
          }
          else if ('update' === opname) {
            Content(`\`\`\`php
[$result, $err] = $client->${ent.Name}()->update([
  "id" => "${ent.name}_id",
  // Fields to update
]);
\`\`\`

`)
          }
        })
      }


      // Common methods
      Content(`### Common Methods

#### \`dataGet(): array\`

Get the entity data. Returns a copy of the current data.

#### \`dataSet($data): void\`

Set the entity data.

#### \`matchGet(): array\`

Get the entity match criteria.

#### \`matchSet($match): void\`

Set the entity match criteria.

#### \`make(): ${ent.Name}Entity\`

Create a new \`${ent.Name}Entity\` instance with the same client and
options.

#### \`getName(): string\`

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

      Content(`\`\`\`php
$client = new ${model.const.Name}SDK([
  "feature" => [
`)
      activeFeatures.map((f: any) => {
        Content(`    "${f.name}" => ["active" => true],
`)
      })
      Content(`  ],
]);
\`\`\`

`)
    }

  })
})




export {
  ReadmeRef
}
