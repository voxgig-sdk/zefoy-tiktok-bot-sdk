
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

import { EntityOperation } from './EntityOperation_rb'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The snake-cased source-file name is unaffected.
  const entityColl = getModelPath(model, `main.${KIT}.entity`)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  const ff = Path.normalize(__dirname + '/../../../src/cmp/rb/fragment/')

  // Entity files go to entity/ folder
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op)

      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['# #' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.rb',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Class token decoupled from the EntityName data-type token in
          // Entity.fragment.rb so the class can be renamed independently.
          EntyClass: cls,

          // Feature-hook markers. jostraca's built-in `#Name-Tag` pattern is
          // hardcoded to `//` comments, so the Ruby fragment's
          // `# #<Name>-Hook` marker lines never matched it and the pipeline
          // hooks (PrePoint, PreRequest, ...) were silently dropped from the
          // generated op runner. Match the `#`-comment form explicitly.
          '/(?<indent>[ \\t]*)#[ \\t]*#(?<name>[A-Za-z0-9]+)-Hook[ \\t]*\\n?/':
            ({ name, indent }: any) =>
              `${indent}utility.feature_hook.call(ctx, "${name}")\n`,

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
