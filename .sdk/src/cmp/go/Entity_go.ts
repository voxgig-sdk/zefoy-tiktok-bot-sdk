
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  entityClassName,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_go'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Module name: concatenated lowercase
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, but disambiguated (e.g. `<Name>EntityClient`) when it would
  // clash with another entity's data-type name. The DATA type stays `<Name>`.
  const entityColl = getModelPath(model, `main.${KIT}.entity`)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/go/fragment/')

  // Entity files go to entity/ folder with snake_case names
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op)

      // For each CRUD op: if the spec defines it, splice in the real
      // implementation. Otherwise emit a stub that satisfies the static
      // ProjectNameEntity interface (so the package compiles) but errors
      // at runtime if the caller invokes an unsupported op.
      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['// #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ?
              ({ indent }: any) => {
                const Method = camelify(opname)
                Content({ indent }, `func (e *${cls}) ${Method}(_ map[string]any, _ map[string]any) (any, error) {
	return core.UnsupportedOp("${opname}", e.name)
}
`)
              } :
              ({ indent }: any) => {
                EntityOperation({ ff, opname, indent, entity, entrep, gomodule, cls })
              }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.go',
        replace: {
          ...entrep,
          'GOMODULE': gomodule,
          '"github.com/voxgig/struct"': `"${gomodule}/utility/struct"`,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class/constructor tokens are decoupled from the EntityName data-type
          // token in Entity.fragment.go so the class can be renamed independently.
          EntyClass: cls,
          NewEntyClass: 'New' + cls,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `utility.FeatureHook(ctx, "${name}")`),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
