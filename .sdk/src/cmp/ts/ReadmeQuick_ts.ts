
import { cmp, each, Content, isAuthActive, packageName, envName, opRequestShape, entityIdField, entityDataIdField, entityOps, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  // Find the first published entity for examples
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
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`ts
import { ${model.const.Name}SDK } from '${packageName(model, target.name)}'

const client = ${ctor}
\`\`\`

`)


  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Variable-safe lowercase name — a `Delete`/`Class` entity must not bind a
    // reserved word (`const delete = ...` is a TS1109 syntax error).
    const eVar = safeVarName(eName.toLowerCase(), 'ts')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    const opnames = entityOps(exampleEntity)
    // Model-driven id key: `idF` is the entity's id-like MATCH field name, or
    // null when it has none (then load/remove match on no argument).
    const idF = entityIdField(exampleEntity)
    // The id field on the RETURNED record's data type, or null. DISTINCT from
    // idF (the match key): an entity can key its load-match on an id it does not
    // carry as a data field, so `.id` off a returned record must be guarded on
    // this — reading `created.id` when the data type has no id is a TS2339.
    const dataIdF = entityDataIdField(exampleEntity)

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` resolves to an array of ${eName} objects — iterate it directly:

\`\`\`ts
const ${eVar}s = await client.${eName}().list()

for (const ${eVar} of ${eVar}s) {
  console.log(${eVar})
}
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neVar = safeVarName(neName.toLowerCase(), 'ts')
      const neArticle = /^[aeiou]/i.test(neName) ? 'an' : 'a'
      const loadOp = nestedEntity.op && nestedEntity.op.load

      // Model-driven match: every REQUIRED load-match key — the same shape
      // that generates <Name>LoadMatch, so the example always type-checks.
      // Parent keys (e.g. page_id) first, the entity's own id last.
      const neIdF = entityIdField(nestedEntity)
      const neRequired = opRequestShape(nestedEntity, 'load').items
        .filter((it: any) => !it.optional)
        .sort((a: any, b: any) =>
          (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
      const parentItem = neRequired.find((it: any) => it.name !== neIdF) as any
      const parentParam = parentItem && parentItem.name
      const parentName = parentParam ? parentParam.replace(/_id$/, '') : 'its parent'
      const neMatchLines = neRequired.map((it: any) =>
        `    ${it.name}: ${exampleValue(nestedEntity, loadOp, it.name,
          it.name === neIdF ? 'example_id' : 'example_' + it.name)},`)

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${parentName}, so provide the \`${parentParam}\`.
\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${neVar} = await client.${neName}().load({
${neMatchLines.join('\n')}
  })
  console.log(${neVar})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`)
    }
    else if (opnames.includes('load')) {
      // Every REQUIRED load-match key (id first) — the same shape that
      // generates <Name>LoadMatch, so the example always type-checks.
      const loadRequired = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadRequired.length
        ? `{ ${loadRequired.map((it: any) =>
          `${it.name}: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.load, it.name,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')} }`
        : ''

      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${eVar} = await client.${eName}().load(${loadArg})
  console.log(${eVar})
} catch (err) {
  console.error('load failed:', err)
}
\`\`\`

`)
    }

    // CRUD operations. The create/update example payloads are derived from the
    // SAME op shapes that generate the <Name>CreateData / <Name>UpdateData types
    // (opRequestShape), so the snippet always type-checks. Prefer writable
    // non-id fields and render a type-correct literal per field via
    // exampleValue — never a hardcoded field the entity may not have.
    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      // Writable non-id example fields for an op body. For create the REQUIRED
      // fields must all appear or the literal is not assignable to the typed
      // <Name>CreateData (a TS2345); update is a patch, so a couple of fields
      // suffice.
      const exampleFields = (opname: string): string[] => {
        // ids are rendered separately as the match key for update/remove; a
        // REQUIRED id stays (dropping it makes the literal unassignable).
        const items = opRequestShape(exampleEntity, opname).items
          .filter((it: any) => (it.name !== idF && it.name !== 'id') ||
            ('create' === opname && !it.optional))
        const required = items.filter((it: any) => !it.optional)
        const optional = items.filter((it: any) => it.optional)
        // Required members must all appear or the literal is not assignable
        // to the typed <Name>{Create,Update}Data; pad update (a patch) with a
        // sample optional field or two.
        const chosen = 'create' === opname
          ? (required.length ? required : items.slice(0, 2))
          : required.concat(optional).slice(0, Math.max(2, required.length))
        return chosen.map((it: any) =>
          `  ${it.name}: ${exampleValue(exampleEntity, exampleEntity.op[opname], it.name, 'example_' + it.name)},`)
      }

      // The id VALUE for an update/remove match. When the entity's DATA type
      // carries the id (dataIdF) AND a `created` record exists, take it off the
      // returned record; otherwise use a type-correct literal — reading
      // `created.id` off an id-less data type is a TS2339.
      const canUseCreatedId = null != dataIdF && opnames.includes('create')
      const idValueFor = (opname: string): string => canUseCreatedId
        ? `created.${dataIdF}!`
        : exampleValue(exampleEntity, exampleEntity.op[opname], idF as string, 'example_id')

      Content(`### 4. Create, update, and remove

\`\`\`ts
`)
      if (opnames.includes('create')) {
        const createLines = exampleFields('create')
        const createBody = createLines.length ? '\n' + createLines.join('\n') + '\n' : ''
        Content(`// Create — returns the created ${eName}
const created = await client.${eName}().create({${createBody}})

`)
      }
      if (opnames.includes('update')) {
        // Match on the id (from the returned `created` record when the data
        // type carries one, else a literal), plus a couple of patch fields.
        const updateLines = (idF ? [`  ${idF}: ${idValueFor('update')},`] : []).concat(exampleFields('update'))
        const updateBody = updateLines.length ? '\n' + updateLines.join('\n') + '\n' : ''
        Content(`// Update${canUseCreatedId ? ' — the id comes straight off the returned entity' : ''}
const updated = await client.${eName}().update({${updateBody}})

`)
      }
      if (opnames.includes('remove')) {
        // Every REQUIRED remove-match key: the id (off the created record
        // when possible) plus parent keys like page_id.
        const removeLines = opRequestShape(exampleEntity, 'remove').items
          .filter((it: any) => !it.optional || it.name === idF)
          .sort((a: any, b: any) =>
            (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
          .map((it: any) => it.name === idF
            ? `  ${it.name}: ${idValueFor('remove')},`
            : `  ${it.name}: ${exampleValue(exampleEntity, exampleEntity.op.remove, it.name, 'example_' + it.name)},`)
        Content(`// Remove
await client.${eName}().remove(${removeLines.length ? `{\n${removeLines.join('\n')}\n}` : ''})
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
