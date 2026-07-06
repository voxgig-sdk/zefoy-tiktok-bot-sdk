
import { cmp, each, Content, isAuthActive, envName, canonKey, opRequestShape, entityIdField, entityDataIdField } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const nestedEntity = Object.values(entity).find((e: any) =>
    e.active !== false && e.ancestors && e.ancestors.length > 0
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
    const opnames = Object.keys(exampleEntity.op || {})
    // Model-driven id keys: `idF` is the load-MATCH key (null when the entity
    // has no id-like field — a response-wrapped spec); when null, load/remove
    // take no argument. `dataIdF` is the id on the RETURNED record's data type —
    // an entity can key its match on an id it does not carry as data, so both a
    // listed record's id column and a `created["id"]` read must be guarded on
    // this, not the match key.
    const idF = entityIdField(exampleEntity)
    const dataIdF = entityDataIdField(exampleEntity)

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
  ${eName.toLowerCase()}s = client.${eName}.list
  ${eName.toLowerCase()}s.each do |item|
    puts "${itemPrint}"
  end
rescue => err
  warn "list failed: #{err}"
end
\`\`\`

`)
    }

    if (opnames.includes('load')) {
      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`\`\`ruby
begin
  # load returns the bare ${eName} record (raises on error).
  ${eName.toLowerCase()} = client.${eName}.load(${idF ? `{ "${idF}" => "example_id" }` : ''})
  puts ${eName.toLowerCase()}
rescue => err
  warn "load failed: #{err}"
end
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Ruby-typed by the
    // field's canonical type.
    const idField = (exampleEntity.id && exampleEntity.id.field) || 'id'
    const rbLit = (type: any): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'true'
      if ('ARRAY' === k) return '[]'
      if ('OBJECT' === k) return '{}'
      return '"example"'
    }
    const examplePairs = (opname: string): string[] => {
      const items = opRequestShape(exampleEntity, opname).items
        .filter((it: any) => it.name !== idField && it.name !== 'id')
      const required = items.filter((it: any) => !it.optional)
      // create needs ALL required fields; update is a patch, so a couple suffice.
      const chosen = 'create' === opname
        ? (required.length ? required : items.slice(0, 2))
        : items.slice(0, 2)
      return chosen.map((it: any) => `"${it.name}" => ${rbLit(it.type)}`)
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
      : rbLit(idParamType(opname))

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
        Content(`# Remove
client.${eName}.remove(${idF ? `{ "${idF}" => ${idValueFor('remove')} }` : ''})
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
