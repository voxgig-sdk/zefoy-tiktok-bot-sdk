
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  configDefinition,
  configReprSetting,
  each,
  isAuthActive,
  isConfigData,
  resolveAuthPrefix,
  serverVariables,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  formatLuaTable,
  luaLongString,
} from './utility_lua'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see make_options).
  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    '      server = {\n' +
    svars.map((v: any) => `        [${JSON.stringify(v.name)}] = ${JSON.stringify(v.dflt)},\n`).join('') +
    '      },\n'

  const authBlock = authActive
    ? `      auth = {
        prefix = "${authPrefix}",
      },\n`
    : ''

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not. Passing the
  // target name opts this target into the main slug/version/target identity
  // fields (station descriptor v1 reads all three) - the literal branch
  // below emits them too, so the two representations cannot diverge.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'config.' + target.ext }, () => {

    Content(`-- ${model.const.Name} SDK configuration

`)

    // ABOVE THE THRESHOLD: emit the model as DATA.
    //
    // A table constructor makes the Lua parser emit a SETTABLE per entry and
    // the VM run them all on every load; a long-bracket string is one token,
    // and dkjson's decoder builds the table from it.
    //
    // dkjson is already a runtime dependency - `utility/fetcher.lua` decodes
    // every HTTP response with it - so this adds nothing to the SDK.
    //
    // Null handling agrees between the branches by construction: dkjson maps
    // JSON null to nil, and assigning nil to a table key removes it, which is
    // exactly what the literal branch does when `formatLuaTable` emits `nil`.
    if (asData) {
      Content(`local json = require("dkjson")


-- THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
--
-- Emitted only above a size threshold, or when \`main.kit.config.repr\` pins
-- it: for a small model the table literal is smaller and far easier to read
-- when debugging.
local CONFIG_DATA = ${luaLongString(configJson)}


-- Parse a fresh, fully materialised config table. Every call re-parses, so
-- prefer require("config_shared") unless you need a private copy you intend
-- to mutate.
local function make_config()
  return json.decode(CONFIG_DATA)
end
`)
    }
    else {

    // Identity values from configDefinition's def, not re-derived here, so
    // the literal rep and the data rep cannot disagree (the ts #MainMeta
    // discipline).
    Content(`-- Build a fresh, fully materialised config table. Every call rebuilds the
-- whole structure, so prefer require("config_shared") unless you need a
-- private copy you intend to mutate.
local function make_config()
  return {
    main = {
      name = "${model.const.Name}",
      slug = ${JSON.stringify(configDef.main.slug)},
      version = ${JSON.stringify(configDef.main.version)},
      target = ${JSON.stringify(configDef.main.target)},
    },
    feature = {
`)

    each(feature, (f: any) => {
      // From configDefinition's def, not f.config, so the literal carries
      // the feature's `transport` role (station design §8.4) beside its
      // options and cannot drift from the data rep.
      const fconfig = configDef.feature[f.name] || {}
      Content(`      ["${f.name}"] = ${formatLuaTable(fconfig, 3)},
`)
    })

    Content(`    },
    options = {
      base = "${baseUrl}",
${serverBlock}${authBlock}      headers = ${formatLuaTable(headers, 3)},
      entity = {
`)

    each(entity, (entity: any) => {
      Content(`        ["${entity.name}"] = {},
`)
    })

    Content(`      },
    },
    entity = ${formatLuaTable(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }, true), a), {}), 2)},
  }
end
`)
    }

    Content(`

local function make_feature(name)
  local features = require("features")
  local factory = features[name]
  if factory ~= nil then
    return factory()
  end
  return features.base()
end


-- Attach make_feature to the SDK class
local function setup_sdk(SDK)
  SDK._make_feature = make_feature
end


return make_config
`)
  })

  // A sibling module rather than a member of `config`: `config` returns a
  // bare function (`require("config")()`), and turning it into a table would
  // change its observable type for any consumer holding it as a factory.
  File({ name: 'config_shared.' + target.ext }, () => {
    Content(`-- ${model.const.Name} SDK shared configuration

local make_config = require("config")

local value = nil


-- Return the config for this Lua state, built once on first use. The SDK
-- reads the config on every request and never writes to it, so one instance
-- is shared by every client rather than rebuilt per client.
--
-- The returned table is shared: treat it as read-only. Callers that need to
-- mutate should use require("config")(), which always returns a fresh copy.
return function()
  if value == nil then
    value = make_config()
  end
  return value
end
`)
  })
})


export {
  Config
}
