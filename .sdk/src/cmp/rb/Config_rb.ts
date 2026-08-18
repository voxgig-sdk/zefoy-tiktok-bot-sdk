
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
  rawStringLiteral,
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
  formatRubyHash,
} from './utility_rb'


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
  // `#` is escaped so a default can never open a Ruby interpolation.
  const svars = serverVariables(model)
  const rbs = (s: string) => JSON.stringify(s).replace(/#/g, '\\#')
  const serverBlock = 0 === svars.length ? '' :
    '        "server" => {\n' +
    svars.map((v: any) => `          ${rbs(v.name)} => ${rbs(v.dflt)},\n`).join('') +
    '        },\n'

  const authBlock = authActive
    ? `        "auth" => {
          "prefix" => "${authPrefix}",
        },\n`
    : ''

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not.
  const { json: configJson } = configDefinition(model)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'config.' + target.ext }, () => {

    Content(`# ${model.const.Name} SDK configuration
${asData ? "\nrequire 'json'\n" : ''}
module ${model.const.Name}Config
  # Return the process-wide config, built once on first use. The SDK reads
  # the config on every request and never writes to it, so one instance is
  # shared by every client rather than rebuilt per client.
  #
  # The returned hash is shared: treat it as read-only. Callers that need to
  # mutate should use make_config, which always returns a fresh copy.
  def self.shared_config
    @shared_config ||= make_config
  end


`)

    // ABOVE THE THRESHOLD: emit the model as DATA.
    //
    // A hash literal makes the Ruby parser build a node per entry and the VM
    // execute an instruction per entry on every load. A string constant is one
    // token, and `JSON.parse` (a C extension) builds the hash far faster.
    //
    // `JSON.parse` yields exactly what the literal did - String keys, Integer
    // for whole numbers, true/false/nil - so make_config's result is unchanged.
    //
    // A SINGLE-quoted literal, so the JSON survives verbatim: a double-quoted
    // Ruby string would interpolate any `#{` the model happens to contain.
    if (asData) {
      Content(`  # THE API MODEL, EMBEDDED AS DATA (sdkgen rung L1).
  #
  # Emitted only above a size threshold, or when \`main.kit.config.repr\` pins
  # it: for a small model the hash literal is smaller and far easier to read
  # when debugging.
  CONFIG_DATA = ${rawStringLiteral(configJson)}.freeze

  # Parse a fresh, fully materialised config hash. Every call re-parses, so
  # prefer shared_config unless you need a private copy you intend to mutate.
  def self.make_config
    JSON.parse(CONFIG_DATA)
  end
`)
    }
    else {

    Content(`  # Build a fresh, fully materialised config hash. Every call rebuilds the
  # whole structure, so prefer shared_config unless you need a private copy
  # you intend to mutate.
  def self.make_config
    {
      "main" => {
        "name" => "${model.const.Name}",
      },
      "feature" => {
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`        "${f.name}" => ${formatRubyHash(fconfig, 4)},
`)
    })

    Content(`      },
      "options" => {
        "base" => "${baseUrl}",
${serverBlock}${authBlock}        "headers" => ${formatRubyHash(headers, 4)},
        "entity" => {
`)

    each(entity, (entity: any) => {
      Content(`          "${entity.name}" => {},
`)
    })

    Content(`        },
      },
      "entity" => ${formatRubyHash(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }, true), a), {}), 3)},
    }
  end
`)
    }

    Content(`

  def self.make_feature(name)
    require_relative 'features'
    ${model.const.Name}Features.make_feature(name)
  end
end
`)
  })
})


export {
  Config
}
