
import { cmp, Content, isAuthActive, envName, canonKey, entityIdField, opRequestShape, safeVarName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// A type-correct, executable Lua literal for a param: numeric/boolean/table
// params render a typed literal; strings render the quoted placeholder (the
// doc test EXECUTES this block, so a comment placeholder would break it).
function luaLit(type: any, placeholder: string = 'example'): string {
  const k = canonKey(type)
  if ('INTEGER' === k || 'NUMBER' === k) return '1'
  if ('BOOLEAN' === k) return 'true'
  if ('ARRAY' === k || 'OBJECT' === k) return '{}'
  return `"${placeholder}"`
}

// Non-identifier table keys use bracket syntax.
function luaKey(name: string): string {
  return /^[A-Za-z_]\w*$/.test(name) ? name : `["${name}"]`
}


const ReadmeTopQuick = cmp(function ReadmeTopQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `sdk.new({\n  apikey = os.getenv("${envName(model)}_APIKEY"),\n})`
    : `sdk.new()`

  Content(`\`\`\`lua
local sdk = require("${model.name}_sdk")

local client = ${ctor}

`)

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    // Sanitise the local variable name — an entity whose lowercased name is a
    // Lua keyword (e.g. `end`) would otherwise emit uncompilable code.
    const eVar = safeVarName(eName.toLowerCase(), 'lua')
    const opnames = Object.keys(exampleEntity.op || {})
    // Model-driven id key: null when the entity has no id-like field, in which
    // case the load example takes no match argument.
    const idF = entityIdField(exampleEntity)

    let hasCall = false

    if (opnames.includes('list')) {
      Content(`-- List all ${eName.toLowerCase()}s
local ${eVar}s, err = client:${eName}():list()
print(${eVar}s)
`)
      hasCall = true
    }

    if (opnames.includes('load')) {
      // Every REQUIRED load-match key (id first, then parent path params like
      // page_id) — the same shape the runtime resolves path params from, so
      // the example always works.
      const loadItems = opRequestShape(exampleEntity, 'load').items
        .filter((it: any) => !it.optional || it.name === idF)
        .sort((a: any, b: any) =>
          (a.name === idF ? 0 : 1) - (b.name === idF ? 0 : 1))
      const loadArg = 0 < loadItems.length
        ? `{ ${loadItems.map((it: any) =>
          `${luaKey(it.name)} = ${luaLit(it.type,
            it.name === idF ? 'example_id' : 'example_' + it.name)}`).join(', ')} }`
        : ''
      Content(`
-- Load a specific ${eName.toLowerCase()}
local ${eVar}, err = client:${eName}():load(${loadArg})
print(${eVar})
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
