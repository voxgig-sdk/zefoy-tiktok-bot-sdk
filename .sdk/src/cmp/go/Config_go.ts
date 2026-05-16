
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
  formatGoMap,
} from './utility_go'


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
    ? `			"auth": map[string]any{
				"prefix": "${authPrefix}",
			},\n`
    : ''

  // Config is now in core/ package
  File({ name: 'config.' + target.ext }, () => {

    Content(`package core

`)

    Content(`func MakeConfig() map[string]any {
	return map[string]any{
		"main": map[string]any{
			"name": "${model.const.Name}",
		},
		"feature": map[string]any{
`)

    each(feature, (f: any) => {
      const fconfig = f.config || {}
      Content(`			"${f.name}": ${formatGoMap(fconfig, 3)},
`)
    })

    Content(`		},
		"options": map[string]any{
			"base": "${baseUrl}",
${authBlock}			"headers": ${formatGoMap(headers, 3)},
			"entity": map[string]any{
`)

    each(entity, (entity: any) => {
      Content(`				"${entity.name}": map[string]any{},
`)
    })

    Content(`			},
		},
		"entity": ${formatGoMap(
      Object.values(entity).reduce((a: any, n: any) => (a[n.name] = clean({
        fields: n.fields,
        name: n.name,
        op: n.op,
        relations: n.relations,
      }), a), {}), 2)},
	}
}

func makeFeature(name string) Feature {
	switch name {
`)

    each(feature, (f: any) => {
      const fname = f.name.charAt(0).toUpperCase() + f.name.slice(1)
      if (f.name !== 'base') {
        Content(`	case "${f.name}":
		if New${fname}FeatureFunc != nil {
			return New${fname}FeatureFunc()
		}
`)
      }
    })

    Content(`	default:
		if NewBaseFeatureFunc != nil {
			return NewBaseFeatureFunc()
		}
	}
	return nil
}
`)
  })
})


export {
  Config
}
