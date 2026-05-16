
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  each,
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
  formatPyDict,
} from './utility_py'


const Config = cmp(async function Config(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  const headers = getModelPath(model, `main.${KIT}.config.headers`) || {}

  const authActive = isAuthActive(model)
  let authPrefix = ''
  try { authPrefix = getModelPath(model, `main.${KIT}.config.auth.prefix`) } catch (_e) { }

  let baseUrl = ''
  try { baseUrl = getModelPath(model, `main.${KIT}.info.servers.0.url`) } catch (_e) { }

  const authBlock = authActive
    ? `            "auth": {
                "prefix": "${authPrefix}",
            },\n`
    : ''

  File({ name: 'config.' + target.ext }, () => {

    Content(`# ${model.const.Name} SDK configuration


def make_config():
    return {
        "main": {
            "name": "${model.const.Name}",
        },
        "feature": {
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`            "${f.name}": ${formatPyDict(fconfig, 3)},
`)
    })

    Content(`        },
        "options": {
            "base": "${baseUrl}",
${authBlock}            "headers": ${formatPyDict(headers, 3)},
            "entity": {
`)

    each(entity, (entity: any) => {
      Content(`                "${entity.name}": {},
`)
    })

    Content(`            },
        },
        "entity": ${formatPyDict(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }), a), {}), 2)},
    }
`)
  })
})


export {
  Config
}
