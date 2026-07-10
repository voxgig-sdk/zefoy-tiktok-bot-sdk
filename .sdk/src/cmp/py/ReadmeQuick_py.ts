
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

  const authActive = isAuthActive(model)
  const apikeyImport = authActive ? `import os\n` : ''
  const ctor = authActive
    ? `${model.const.Name}SDK({\n    "apikey": os.environ.get("${envName(model)}_APIKEY"),\n})`
    : `${model.const.Name}SDK()`

  Content(`### 1. Create a client

\`\`\`python
${apikeyImport}from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK

client = ${ctor}
\`\`\`

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const article = /^[aeiou]/i.test(eName) ? 'an' : 'a'
    // Sanitise the local variable name — an entity whose lowercased name is a
    // Python keyword (e.g. `class`) would otherwise emit uncompilable code.
    const eVar = safeVarName(eName.toLowerCase(), 'py')
    const opnames = entityOps(exampleEntity)
    // Model-driven id key: `idF` is the entity's id-like MATCH field name, or
    // null when it has none (a response-wrapped spec). `dataIdF` is the id on
    // the RETURNED record's data type — an entity can key its match on an id it
    // does not carry as data, so indexing `created["id"]` when the data type has
    // none is wrong (and would KeyError at runtime).
    const idF = entityIdField(exampleEntity)
    const dataIdF = entityDataIdField(exampleEntity)

    // A type-correct, executable Python literal for a param: numeric/boolean/
    // array/object params render a typed literal; strings render the quoted
    // placeholder (the doc test EXECUTES these blocks, so a comment
    // placeholder would not parse).
    const pyLit = (type: any, placeholder: string = 'example'): string => {
      const k = canonKey(type)
      if ('INTEGER' === k || 'NUMBER' === k) return '1'
      if ('BOOLEAN' === k) return 'True'
      if ('ARRAY' === k) return '[]'
      if ('OBJECT' === k) return '{}'
      return `"${placeholder}"`
    }

    if (opnames.includes('list')) {
      Content(`### 2. List ${eName.toLowerCase()} records

\`list()\` returns a \`list\` of records (each a \`dict\`) and raises on
error — iterate it directly.

\`\`\`python
try:
    ${eVar}s = client.${eName}().list()
    for ${eVar} in ${eVar}s:
        print(${eVar})
except Exception as err:
    print(f"list failed: {err}")
\`\`\`

`)
    }

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neArticle = /^[aeiou]/i.test(neName) ? 'an' : 'a'
      const neVar = safeVarName(neName.toLowerCase(), 'py')

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
        `"${it.name}": ${pyLit(it.type,
          it.name === neIdF ? 'example_id' : 'example_' + it.name)}`)

      Content(`### 3. Load ${neArticle} ${neName.toLowerCase()}

${neName} is nested under ${parentName}, so provide the \`${parentParam}\`.
\`load()\` returns the bare record (a \`dict\`) and raises on error.

\`\`\`python
try:
    ${neVar} = client.${neName}().load({${neMatch.join(', ')}})
    print(${neVar})
except Exception as err:
    print(f"load failed: {err}")
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
        ? `{${loadRequired.map((it: any) =>
          `"${it.name}": ${pyLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')}}`
        : ''

      Content(`### 3. Load ${article} ${eName.toLowerCase()}

\`load()\` returns the bare record (a \`dict\`) and raises on error.

\`\`\`python
try:
    ${eVar} = client.${eName}().load(${loadArg})
    print(${eVar})
except Exception as err:
    print(f"load failed: {err}")
\`\`\`

`)
    }

    // Model-driven example fields: derive the create/update body from the op
    // shape (opRequestShape) so the docs reference REAL writable fields, not a
    // hardcoded "name" the entity may not have. Literals are Python-typed by
    // the field's canonical type. ids are rendered separately as the match key
    // for update/remove; a REQUIRED create id stays (the call is invalid
    // without it).
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
      return chosen.map((it: any) => `"${it.name}": ${pyLit(it.type, 'example_' + it.name)}`)
    }

    // The id VALUE for an update/remove match: taken off the returned `created`
    // record only when its data type carries the id AND a create ran; otherwise
    // a type-correct literal.
    const idParamType = (opname: string): any => {
      const it = opRequestShape(exampleEntity, opname).items.find((x: any) => x.name === idF)
      return it && it.type
    }
    const idValueFor = (opname: string): string => (null != dataIdF && opnames.includes('create'))
      ? `created["${dataIdF}"]`
      : pyLit(idParamType(opname), 'example_id')

    if (opnames.includes('create') || opnames.includes('update') || opnames.includes('remove')) {
      Content(`### 4. Create, update, and remove

\`\`\`python
`)
      if (opnames.includes('create')) {
        Content(`# Create — returns the bare created record (a dict)
created = client.${eName}().create({${examplePairs('create').join(', ')}})

`)
      }
      if (opnames.includes('update')) {
        const updatePairs = (idF ? [`"${idF}": ${idValueFor('update')}`] : []).concat(examplePairs('update'))
        const fromCreated = null != dataIdF && opnames.includes('create')
        Content(`# Update${fromCreated ? " — the created record's id is a plain dict key" : ''}
client.${eName}().update({${updatePairs.join(', ')}})

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
            ? `"${it.name}": ${idValueFor('remove')}`
            : `"${it.name}": ${pyLit(it.type, 'example_' + it.name)}`)
        Content(`# Remove
client.${eName}().remove(${removePairs.length ? `{${removePairs.join(', ')}}` : ''})
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
