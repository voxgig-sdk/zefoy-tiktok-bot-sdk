
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  each,
  indent,
  isAuthActive,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
} from '@voxgig/apidef'


import {
  clean,
  formatJson,
} from './utility_js'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const ff = Path.normalize(__dirname + '/../../../src/cmp/js/fragment/')

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  let authPrefix = 'Bearer'
  try {
    const v = getModelPath(model, `main.${KIT}.config.auth.prefix`,
      { only_active: false, required: false })
    if (null != v) authPrefix = v
  } catch (_e) { /* ignore */ }
  const authBlock = authActive
    ? `auth: {
      prefix: '${authPrefix}',
    },

    `
    : ''

  File({ name: 'Config.' + target.ext }, () => {

    Fragment({
      from: ff + 'Config.fragment.js',

      replace: {

        "'AUTHBLOCK'": authBlock,

        "'HEADERS'": indent(JSON.stringify(headers, null, 2), 4).trim(),

        '// #ImportFeatures': () => each(feature, (f: any) => {
          Line(`const { ${nom(f, 'Name')}Feature } = ` +
            `require('./feature/${f.name}/${nom(f, 'Name')}Feature')`)
        }),

        '// #FeatureClasses': () => each(feature, (f: any) => {
          Line(` ${f.name}: ${nom(f, 'Name')}Feature`)
        }),

        '// #FeatureConfigs': () => each(feature, (f: any) => {
          Line(` ${f.name}: ${formatJson(f.config, { margin: 4 })}`)
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
          }), a), {}), { margin: 2 }).trim(),
      }
    })
  })
})


export {
  Config
}
