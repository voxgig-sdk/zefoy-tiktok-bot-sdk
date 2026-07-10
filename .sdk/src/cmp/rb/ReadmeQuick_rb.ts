
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
    ? `${model.const.Name}SDK.new({\n  "apikey" => ENV["${envName(model)}_APIKEY"],\n})`
    : `${model.const.Name}SDK.new`

  Content(`### 1. Create a client

\`\`\`ruby
require_relative "${model.const.Name}_sdk"

client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? "an" : "a"
    // Sanitise the local variable name — an entity whose lowercased name is a
    // Ruby keyword (e.g. `self`) would otherwise emit uncompilable code.
    const eVar = safeVarName(eName.toLowerCase(), 'rb')
    const opnames = entityOps(exampleEntity)
    // Model-driven id keys: `idF` is the load-MATCH key (null when the entity
    // has no id-like field — a response-wrapped spec); when null, load/remove
    // take no argument. `dataIdF` is the id on the RETURNED record's data type —
    // an entity can key its match on an id it does not carry as data, so both a
    // listed record's id column and a `created["id"]` read must be guarded on
    // this, not the match key.
    const idF = entityIdField(exampleEntity)
    const dataIdF = entityDataIdField(exampleEntity)

    // A type-correct, executable Ruby literal for a param: numeric/boolean/
    // array/hash params render a typed literal; strings render the quoted
    // placeholder (the doc test EXECUTES these blocks, so a comment
    // placeholder would not parse).
    const rbLit = (type: any, placeholder: string = 'example'): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k) return '[]'
      if ('OBJECT' === k) return '{}'
      return `"${placeholder}"`
    }

    // Model-driven display field: the entity's first non-id string field
    // (falling back to any non-id field), so the list example prints a real
    // column instead of a hardcoded "name" the entity may not have.
    const fields = exampleEntity.fields || []
    const displayField =
      fields.find((f: any) => f && f.name !== 'id' && f.type === '$STRING') ||
      fields.find((f: any) => f && f.name !== 'id') ||
      null
    const idCol = dataIdF ? `#{item[${JSON.stringify(dataIdF)}]}` : null
    const dispCol = displayField ? `#{item[${JSON.stringify(displayField.name)}]}` : null
    const itemPrint = [idCol, dispCol].filter(Boolean).join(' ') || '#{item}'

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`\`\`ruby
begin
  # list returns an Array of ${eName} records — iterate directly.
  ${eVar}s = client.${eName}.list
  ${eVar}s.each do |item|
    puts "${itemPrint}"
  end
rescue => err
  warn "list failed: #{err}"
end
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neArticle = /^[aeiou]/i.test(neName) ? "an" : "a"
      const neVar = safeVarName(neName.toLowerCase(), 'rb')

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
        `"${it.name}" => ${rbLit(it.type,
          it.name === neIdF ? 'example_id' : 'example_' + it.name)}`)

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${parentName}, so provide the \`${parentParam}\`.

\`\`\`ruby
begin
  # load returns the bare ${neName} record (raises on error).
  ${neVar} = client.${neName}.load({ ${neMatch.join(', ')} })
  puts ${neVar}
rescue => err
  warn "load failed: #{err}"
end
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
          `"${it.name}" => ${rbLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')} }`
        : ''

      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`ruby
begin
  # load returns the bare ${eName} record (raises on error).
  ${eVar} = client.${eName}.load(${loadArg})
  puts ${eVar}
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Ruby-typed by the
    // field's canonical type. ids are rendered separately as the match key for
    // update/remove; a REQUIRED create id stays (the call is invalid without
    // it).
    const examplePairs = (opname: string): string[] => {
      const items = opRequestShape(exampleEntity, opname).items
        .filter((it: any) => (it.name !== idF && it.name !== 'id') ||
          ('create' === opname && !it.optional))
      const required = items.filter((it: any) => !it.optional)
      const optional = items.filter((it: any) => it.optional)
      // create needs ALL required fields; update is a patch, so the required
      // members plus a sample optional field or two suffice.
      const chosen = 'create' === opname
        ? (required.length ? required : items.slice(0, 2))
        : required.concat(optional).slice(0, Math.max(2, required.length))
      return chosen.map((it: any) => `"${it.name}" => ${rbLit(it.type, 'example_' + it.name)}`)
    }

    // The id VALUE for an update/remove match: off the returned `created`
    // record only when its data type carries the id AND a create ran, else a
    // type-correct literal (so an update-without-create never references an
    // undefined `created`).
    const idParamType = (opname: string): any => {
      const it = opRequestShape(exampleEntity, opname).items.find((x: any) => x.name === idF)
      return it && it.type
    }
    const idValueFor = (opname: string): string => (null != dataIdF && opnames.includes('create'))
      ? `created["${dataIdF}"]`
      : rbLit(idParamType(opname), 'example_id')

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`ruby
`)
      if (opnames.includes('create')) {
        Content(`# create returns the bare created ${eName} record.
created = client.${eName}.create({ ${examplePairs('create').join(', ')} })

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (idF ? [`"${idF}" => ${idValueFor('update')}`] : []).concat(examplePairs('update'))
        const fromCreated = null != dataIdF && opnames.includes('create')
        Content(`# Update${fromCreated ? ` — index the bare record directly (created["${dataIdF}"]).` : ''}
client.${eName}.update({ ${updatePairs.join(', ')} })

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
            ? `"${it.name}" => ${idValueFor('remove')}`
            : `"${it.name}" => ${rbLit(it.type, 'example_' + it.name)}`)
        Content(`# Remove
client.${eName}.remove(${removePairs.length ? `{ ${removePairs.join(', ')} }` : ''})
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
