
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot
} from '@voxgig/sdkgen'

import { EntityOperation } from './EntityOperation_py'


// Op -> generated request-type suffix (keep in sync with EntityTypes_py.ts).
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
  // one request type per ACTIVE op (matches what EntityTypes_py.ts emits).
  const typeNames = [entity.Name]
  const opnamesAll = Object.keys(entity.op || {})
  ;['load', 'list', 'create', 'update', 'remove'].forEach((opname: string) => {
    if (opnamesAll.includes(opname)) {
      const suffix = OP_SUFFIX[opname] || 'Match'
      const cap = opname.charAt(0).toUpperCase() + opname.slice(1)
      typeNames.push(entity.Name + cap + suffix)
    }
  })
  const typesModule = model.const.Name.toLowerCase() + '_types'
  const typeImport =
    'from ' + typesModule + ' import (\n    ' +
    typeNames.join(',\n    ') + ',\n)'

  const ff = Path.normalize(__dirname + '/../../../src/cmp/py/fragment/')

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
        from: ff + 'Entity.fragment.py',
        replace: {
          ...entrep,
          ProjectName: model.const.Name,
          EntityName: entity.Name,
          entityname: entity.name,

          // Literal-marker slot (jostraca's `#Name` tag pattern is hardcoded to
          // `//` comments, so Python uses a `# #`-prefixed literal like the op
          // frag slots) — fills in the typed-model import for this entity.
          '# #TypeImports': typeImport,

          '#Entity-Hook': ({ name, indent }: any) =>
            Content({ indent }, `utility.feature_hook(ctx, "${name}")`),

          ...opfrags,
        }
      })

    })
  })
})



export {
  Entity
}
