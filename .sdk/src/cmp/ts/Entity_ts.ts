
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot
} from '@voxgig/sdkgen'

import { EntityOperation } from './EntityOperation_ts'
// import { EntityTest } from './EntityTest_ts'


// Op -> generated request-type suffix (keep in sync with EntityTypes_ts.ts).
const OP_SUFFIX: Record<string, 'Match' | 'Data'> = {
  load: 'Match', list: 'Match', remove: 'Match', create: 'Data', update: 'Data',
}


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  const entrep = {
    ...stdrep,
  }

  names(entrep, entity.Name, 'EntityName')

  // Import exactly the typed models this entity references: its data type plus
  // one request type per ACTIVE op (matches what EntityTypes_ts.ts emits).
  const typeNames = [entity.Name]
  const opnamesAll = Object.keys(entity.op || {})
  ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
    if (opnamesAll.includes(opname)) {
      const suffix = OP_SUFFIX[opname] || 'Match'
      const cap = opname.charAt(0).toUpperCase() + opname.slice(1)
      typeNames.push(entity.Name + cap + suffix)
    }
  })
  const typeImport =
    'import type {\n  ' + typeNames.join(',\n  ') +
    `,\n} from '../${model.const.Name}Types'`

  const ff = Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/')

  Folder({ name: 'src/entity' }, () => {

    File({ name: entity.Name + 'Entity.' + target.name }, () => {

      const opnames = Object.keys(entity.op)

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
