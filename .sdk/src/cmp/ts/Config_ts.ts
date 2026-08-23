
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  clean,
  configDefinition,
  configReprSetting,
  each,
  indent,
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
  formatJson,
} from './utility_ts'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  // config.auth.prefix override -> spec-derived info.security.prefix -> 'Bearer'
  const authPrefix = resolveAuthPrefix(model)
  const authBlock = authActive
    ? `auth: {
      prefix: '${authPrefix}',
    },

    `
    : ''

  // Templated server URL: emit the spec's server-variable defaults so the
  // runtime can substitute {name} placeholders in base (see makeOptions).
  const svars = serverVariables(model)
  const serverBlock = 0 === svars.length ? '' :
    'server: {\n' +
    svars.map((v: any) => `      ${JSON.stringify(v.name)}: ${JSON.stringify(v.dflt)},\n`).join('') +
    '    },\n\n    '

  // Read the base URL here rather than leaving it to a `$$...$$` stdrep
  // placeholder in the fragment. stdrep can only substitute a path the model
  // actually has: a model with no `info.servers` left the placeholder itself in
  // the generated source, so `options.base` came out as the literal string
  // '$main.kit.info.servers.0.url$'. Reading it explicitly yields '' in that
  // case, which is what every other target already emits, and is identical to
  // the old output whenever the model does define a server.
  let baseUrl = ''
  try {
    baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`)
  } catch (_e) { }

  // The same config as an OBJECT, built by the shared helper so this target's
  // literal and the data that replaces it above the threshold are the same
  // config by construction. The JSON is what the threshold is measured on -
  // emitted source size varies by language, the model does not.
  const { def: configDef, json: configJson } = configDefinition(model, target.name)
  const asData = isConfigData(configJson, configReprSetting(model))

  File({ name: 'Config.' + target.ext }, () => {

    if (asData) {
      Fragment({
        from: ff + 'Config.data.fragment.ts',

        replace: {

          '// #ImportFeatures': () => each(feature, (f: any) => {
            Line(`import { ${nom(f, 'Name')}Feature } from ` +
              `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
          }),

          '// #FeatureClasses': () => each(feature, (f: any) => {
            Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
          }),

          // A JS string literal, so the JSON survives verbatim. JSON.stringify
          // escapes the quotes and backslashes the model contains (values like
          // `$STRING` carry backticks, which a template literal could not).
          "'CONFIGJSON'": JSON.stringify(configJson),
        }
      })
      return
    }

    Fragment({
      from: ff + 'Config.fragment.ts',

      replace: {

        "'BASEURL'": JSON.stringify(baseUrl),

        "'SERVERBLOCK'": serverBlock,

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": indent(JSON.stringify(headers, null, 2), 4).trim(),

        '// #ImportFeatures': () => each(feature, (f: any) => {
          Line(`import { ${nom(f, 'Name')}Feature } from ` +
            `'./feature/${f.name}/${nom(f, 'Name')}Feature'`)
        }),

        // Values from configDefinition's def, not re-derived here, so the
        // literal rep and the data rep cannot disagree on identity.
        '// #MainMeta': () => {
          Line(`    slug: ${JSON.stringify(configDef.main.slug)},`)
          Line(`    version: ${JSON.stringify(configDef.main.version)},`)
          Line(`    target: ${JSON.stringify(configDef.main.target)},`)
        },

        '// #FeatureClasses': () => each(feature, (f: any) => {
          // Trailing comma: the map has one entry per feature, so entries
          // must be comma-separated (a single feature hid this until now).
          Line(` ${f.name}: ${nom(f, 'Name')}Feature,`)
        }),

        '// #FeatureConfigs': () => each(feature, (f: any) => {
          Line(` ${f.name}: ${formatJson(f.config, { margin: 4 })},`)
        }),


        '// #EntityConfigs': () => each(entity, (entity: any) => {
          Content(`
      ${entity.name}: {
      },
`)
        }),

        "'ENTITYMAP'": formatJson(Object.values(entity)
          .reduce((a: any, n: any) => (a[n.name] = clean({
            fields: n.fields,
            name: n.name,
            op: n.op,
            relations: n.relations,
          }, true), a), {}), { margin: 2 }).trim(),
      }
    })
  })
})


export {
  Config
}
