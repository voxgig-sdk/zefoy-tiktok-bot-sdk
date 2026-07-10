
import { cmp, each, Content, isAuthActive, envName, canonKey, opRequestShape, entityIdField, entityDataIdField, entityOps, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  // Find a nested entity if available: one with a parent chain
  // (relations.ancestors), an active load op, and a required non-id load
  // param to demonstrate (the parent key, e.g. page_id).
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false &&
    e.relations && e.relations.ancestors && 0 < e.relations.ancestors.length &&
    entityOps(e).includes('load') &&
    opRequestShape(e, 'load').items.some((it: any) =>
      !it.optional && it.name !== entityIdField(e))
  ) as any

  const ctor = isAuthActive(model)
    ? `sdk.new({\n  apikey = os.getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.new()`

  Content(`### 1. Create a client

\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    // Sanitise the local variable name — an entity whose lowercased name is a
    // Lua keyword (e.g. `end`) would otherwise emit uncompilable code.
    const eVar = safeVarName(eName.toLowerCase(), 'lua')
    const opnames = entityOps(exampleEntity)
    // Model-driven id key: `idF` is the MATCH key (null when none). `dataIdF`
    // is the id on the RETURNED record's data type — an entity can key its match
    // on an id it does not carry as data, so a record id read (`item["id"]`,
    // `created["id"]`) must be guarded on this, not the match key.
    const idF = entityIdField(exampleEntity)
    const dataIdF = entityDataIdField(exampleEntity)

    // A type-correct, executable Lua literal for a param: numeric/boolean/
    // table params render a typed literal; strings render the quoted
    // placeholder (the doc test EXECUTES these blocks, so a comment
    // placeholder would not parse). Non-identifier keys use bracket syntax.
    const luaLit = (type: any, placeholder: string = 'example'): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k || 'OBJECT' === k) return '{}'
      return `"${placeholder}"`
    }
    const luaKey = (name: string): string =>
      /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`

    // MODEL-DRIVEN display field: the list example must reference a field
    // the entity actually has, not a hardcoded "name". Pick the entity's
    // first non-id string field (falling back to the first non-id field of
    // any type). The id key stays `id` — the SDK renames every id param to
    // `id`, matching the load example and the seeded test fixture.
    const idNames = new Set<string>(['id',
      (exampleEntity.id && exampleEntity.id.field) || 'id'])
    const fields: any[] = Array.isArray(exampleEntity.fields) ? exampleEntity.fields : []
    const isStringField = (f: any) =>
      f && typeof f.type === 'string' && /STRING/i.test(f.type)
    const displayFieldObj =
      fields.find((f: any) => f && !idNames.has(f.name) && isStringField(f)) ||
      fields.find((f: any) => f && !idNames.has(f.name))
    const displayField = displayFieldObj ? displayFieldObj.name : null
    const idCol = dataIdF ? `item["${dataIdF}"]` : null
    const dispCol = displayField ? `item["${displayField}"]` : null
    const printCols = [idCol, dispCol].filter(Boolean).join(', ')
    const printLine = printCols ? `  print(${printCols})` : `  print(item)`

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

Entity operations return \`(value, err)\`. For \`list\`, \`value\` is the
array of records itself — iterate it directly (there is no wrapper).

\`\`\`lua
local ${eVar}s, err = client:${eName}():list()
if err then error(err) end

for _, item in ipairs(${eVar}s) do
${printLine}
end
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neArticle = /^[aeiou]/i.test(neName) ? "an" : "a"
      const neVar = safeVarName(neName.toLowerCase(), 'lua')

      // Model-driven match: every REQUIRED load-match key — the same shape
      // the runtime resolves path params from, so the example always works.
      // Parent keys (e.g. page_id) first, the entity's own id last.
      const neIdF = entityIdField(nestedEntity)
      const neRequired = opRequestShape(nestedEntity, 'load').items
        .filter((it: any) => !it.optional)
        .sort((a: any, b: any) =>
          (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
      const parentItem = neRequired.find((it: any) => it.name !== neIdF) as any
      const parentParam = parentItem && parentItem.name
      const parentName = parentParam ? parentParam.replace(/_id$/, '') : 'its parent'
      const neMatch = neRequired.map((it: any) =>
        `${luaKey(it.name)} = ${luaLit(it.type,
          it.name === neIdF ? 'example_id' : 'example_' + it.name)}`)

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${parentName}, so provide the \`${parentParam}\`.

\`\`\`lua
local ${neVar}, err = client:${neName}():load({ ${neMatch.join(', ')} })
if err then error(err) end
print(${neVar})
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      // Every REQUIRED load-match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from, so
      // the example always works.
      const loadRequired = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadRequired.length
        ? `{ ${loadRequired.map((it: any) =>
          `${luaKey(it.name)} = ${luaLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')} }`
        : ''

      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`lua
local ${eVar}, err = client:${eName}():load(${loadArg})
if err then error(err) end
print(${eVar})
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Lua-typed by the
    // field's canonical type; non-identifier keys use bracket syntax. ids are
    // rendered separately as the match key for update/remove; a REQUIRED
    // create id stays (the call is invalid without it).
    const examplePairs = (opname: string): string[] => {
      const items = opRequestShape(exampleEntity, opname).items
        .filter((it: any) => !idNames.has(it.name) ||
          ('create' === opname && !it.optional))
      const required = items.filter((it: any) => !it.optional)
      const optional = items.filter((it: any) => it.optional)
      // create needs ALL required fields; update is a patch, so the required
      // members plus a sample optional field or two suffice.
      const chosen = 'create' === opname
        ? (required.length ? required : items.slice(0, 2))
        : required.concat(optional).slice(0, Math.max(2, required.length))
      return chosen.map((it: any) =>
        `${luaKey(it.name)} = ${luaLit(it.type, 'example_' + it.name)}`)
    }

    // The id VALUE for an update/remove match: off the returned `created` record
    // only when its data type carries the id AND a create ran, else a literal.
    const idParamType = (opname: string): any => {
      const it = opRequestShape(exampleEntity, opname).items.find((x: any) => x.name === idF)
      return it && it.type
    }
    const idValueFor = (opname: string): string => (null != dataIdF && opnames.includes('create'))
      ? `created["${dataIdF}"]`
      : luaLit(idParamType(opname), 'example_id')

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`lua
`)
      if (opnames.includes('create')) {
        Content(`-- Create
local created, err = client:${eName}():create({ ${examplePairs('create').join(', ')} })
if err then error(err) end

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (idF ? [`${idF} = ${idValueFor('update')}`] : []).concat(examplePairs('update'))
        Content(`-- Update
client:${eName}():update({ ${updatePairs.join(', ')} })

`)
      }
      if (opnames.includes('remove')) {
        // Every REQUIRED remove-match key: the id (off the created record
        // when possible) plus parent keys like page_id.
        const removePairs = opRequestShape(exampleEntity, 'remove').items
          .filter((it: any) => !it.optional || it.name === idF)
          .sort((a: any, b: any) =>
            (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
          .map((it: any) => it.name === idF
            ? `${luaKey(it.name)} = ${idValueFor('remove')}`
            : `${luaKey(it.name)} = ${luaLit(it.type, 'example_' + it.name)}`)
        Content(`-- Remove
client:${eName}():remove(${removePairs.length ? `{ ${removePairs.join(', ')} }` : ''})
`)
      }
      Content(`\`\`\`

`)
    }
  }
})


export {
  ReadmeQuick
}
