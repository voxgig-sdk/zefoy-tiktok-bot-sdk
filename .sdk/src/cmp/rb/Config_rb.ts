
import * as Path from 'node:path'


import {
  Content,
  File,
  Fragment,
  Line,
  cmp,
  each,
  isAuthActive,
  resolveAuthPrefix,
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

  const authBlock = authActive
    ? `        "auth" => {
          "prefix" => "${authPrefix}",
        },\n`
    : ''

  File({ name: 'config.' + target.ext }, () => {

    Content(`# ${model.const.Name} SDK configuration

module ${model.const.Name}Config
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
${authBlock}        "headers" => ${formatRubyHash(headers, 4)},
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
      }), a), {}), 3)},
    }
  end


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
