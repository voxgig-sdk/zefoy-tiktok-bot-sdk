
import { cmp, each, Content, isAuthActive, packageName, envName, opRequestShape, entityIdField, entityDataIdField, safeVarName } from '@voxgig/sdkgen'

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

  // Find a nested entity if available
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
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
    const opnames = Object.keys(exampleEntity.op || {})
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
      const parentFields = (nestedEntity.fields || [])
        .filter((f: any) => f.name !== 'id' && f.name.endsWith('_id'))
      const parentParam = parentFields.length > 0 ? parentFields[0].name : 'parent_id'
      const loadOp = nestedEntity.op && nestedEntity.op.load

      // Model-driven id key: only emit an id match line if this nested entity
      // actually has an id-like key field (some response-wrapped specs do not).
      const neIdF = entityIdField(nestedEntity)
      const neMatchLines = [`    ${parentParam}: ${exampleValue(nestedEntity, loadOp, parentParam, 'example')},`]
      if (neIdF) {
        neMatchLines.push(`    ${neIdF}: ${exampleValue(nestedEntity, loadOp, neIdF, 'example_id')},`)
      }

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${eName}, so provide the \`${parentParam}\`.
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
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the entity directly and throws on failure:

\`\`\`ts
try {
  const ${eVar} = await client.${eName}().load(${idF ? `{ ${idF}: ${exampleValue(exampleEntity, exampleEntity.op && exampleEntity.op.load, idF, 'example_id')} }` : ''})
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
        const items = opRequestShape(exampleEntity, opname).items
          .filter((it: any) => it.name !== idF && it.name !== 'id')
        const required = items.filter((it: any) => !it.optional)
        const chosen = 'create' === opname
          ? (required.length ? required : items.slice(0, 2))
          : items.slice(0, 2)
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
        Content(`// Remove
await client.${eName}().remove(${idF ? `{\n  ${idF}: ${idValueFor('remove')},\n}` : ''})
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
