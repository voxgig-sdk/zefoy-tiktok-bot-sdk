
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  opTypeName, entityClassName, entityCollection, tsSafeTypeName,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_ts'
// import { EntityTest } from './EntityTest_ts'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The DATA type stays `<Name>`. The class file name and the
  // Main import path both use this, so they always agree.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  // A TS/JS global (Record, Array, Promise, ...) would shadow itself for
  // the rest of the file — see tsSafeTypeName. The runtime `this.Name`
  // string stays entity.Name; only the TYPE reference is ever renamed.
  const dataType = tsSafeTypeName(entity.Name)

  // Import exactly the typed models this entity references: its data type plus
  // one request type per ACTIVE op (matches what EntityTypes_ts.ts emits).
  const typeNames = [dataType]
  const opnamesAll = Object.keys(entity.op || {})
  ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
    if (opnamesAll.includes(opname)) {
      typeNames.push(opTypeName(entity.Name, opname))
    }
  })
  const typeImport =
    'import type {\n  ' + typeNames.join(',\n  ') +
    `,\n} from '../${model.const.Name}Types'`

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  Folder({ name: 'src/entity' }, () => {

    File({ name: cls + '.' + target.name }, () => {

      const opnames = Object.keys(entity.op || {})

      const opfrags =
        (['load', 'list', 'create', 'update', 'remove']
          .reduce((a: any, opname: string) =>
          (a['#' + camelify(opname) + 'Op'] =
            !opnames.includes(opname) ? '' : ({ indent }: any) => {
              EntityOperation({ ff, opname, indent, entity, entrep })
            }, a), {}))

      Fragment({
        from: ff + 'Entity.fragment.ts',
        replace: {
          ...entrep,
          entityname: entity.name,
          SdkName: model.const.Name,
          EntityName: entity.Name,
          EntityDataType: dataType,

          // Class token decoupled from the EntityName data-type token in
          // Entity.fragment.ts so the class can be renamed independently.
          EntyClass: cls,

          '#TypeImports': ({ indent }: any) => Content({ indent }, typeImport),

          '#Feature-Hook': ({ name, indent }: any) =>
            Content({ indent }, `
fres = featureHook(ctx, '${name}')
if (fres instanceof Promise) { await fres }
`.trim()),

          ...opfrags,
        }
      })

    })
  })

  // EntityTest({ target, entity, entrep, ff })
})



export {
  Entity
}
