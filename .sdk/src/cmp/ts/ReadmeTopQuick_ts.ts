
import { cmp, Content, isAuthActive, packageName, envName, entityIdField, entityOps, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'

import { exampleValue } from './utility_ts'


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `new ${model.const.Name}SDK({\n  apikey: process.env.${envName(model)}_APIKEY,\n})`
    : `new ${model.const.Name}SDK()`

  Content(`\`\`\`ts
import { ${model.const.Name}SDK } from '${packageName(model, target.name)}'

const client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const eVar = safeVarName(eName.toLowerCase(), 'ts')
    const opnames = entityOps(exampleEntity)

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`// List all ${eName.toLowerCase()}s (returns ${eName}[])
const ${eVar}s = await client.${eName}().list()
for (const ${eVar} of ${eVar}s) {
  console.log(${eVar})
}
`)
      hasCall = true
    }

    // Find a nested entity for a more interesting example: one with a parent
    // chain, an active load op of its OWN, and a required non-id load param
    // to demonstrate (the parent key, e.g. page_id).
    const nestedEntity = Object.values(entity).find((e: any) =>
      e.active !== false &&
      e.relations && e.relations.ancestors && 0 < e.relations.ancestors.length &&
      entityOps(e).includes('load') &&
      opRequestShape(e, 'load').items.some((it: any) =>
        !it.optional && it.name !== entityIdField(e))
    ) as any

    if (nestedEntity) {
      const neName = nom(nestedEntity, 'Name')
      const neVar = safeVarName(neName.toLowerCase(), 'ts')
      const loadOp = nestedEntity.op && nestedEntity.op.load

      // Every REQUIRED load-match key (parent keys first, own id last) — the
      // same shape that generates <Name>LoadMatch, so the example
      // type-checks.
      const neIdF = entityIdField(nestedEntity)
      const neMatchLines = opRequestShape(nestedEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === neIdF)
        .sort((a: any, b: any) =>
          (a.name === neIdF ? 1 : 0) - (b.name === neIdF ? 1 : 0))
        .map((it: any) =>
          `  ${it.name}: ${exampleValue(nestedEntity, loadOp, it.name,
            it.name === neIdF ? 'example_id' : 'example_' + it.name)},`)

      Content(`
// Load a specific ${neName.toLowerCase()} (returns a ${neName})
const ${neVar} = await client.${neName}().load({
${neMatchLines.join('\n')}
})
console.log(${neVar})
`)
      hasCall = true
    }

    // Fallback: APIs with only `load` (no list, no nested) — most public
    // read-only services. Still show one concrete call. `load()` with no
    // match is always valid (the match arg is optional).
    if (!hasCall && opnames.includes('load')) {
      Content(`// Load ${eName.toLowerCase()} data (returns a ${eName})
const ${eVar} = await client.${eName}().load()
console.log(${eVar})
`)
      hasCall = true
    }
  }

  Content(`\`\`\`
`)

})


export {
  ReadmeTopQuick
}
