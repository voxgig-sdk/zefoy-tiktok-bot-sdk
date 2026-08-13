
import * as Path from 'node:path'

import {
  cmp, each, camelify, names,
  File, Content, Folder, Fragment, Line, FeatureHook, Slot,
  entityClassName, entityCollection, opTypeName,
} from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import { EntityOperation } from './EntityOperation_py'


const Entity = cmp(function Entity(props: any) {
  const { model, stdrep } = props.ctx$
  const { target, entity } = props

  // Collision-free entity CLASS name (see entityClassName): normally
  // `<Name>Entity`, disambiguated when it would clash with another entity's
  // data-type name. The DATA type stays `<Name>`. The snake-cased source-file
  // name is unaffected; only the class identifier changes.
  const entityColl = entityCollection(model)
  const cls = entityClassName(entity, entityColl)

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
      typeNames.push(opTypeName(entity.Name, opname))
    }
  })
  // The generated dataclasses live inside the SDK package alongside
  // everything else, so the import is package-qualified.
  const typesModule = model.const.Name.toLowerCase() + '_sdk.' +
    model.const.Name.toLowerCase() + '_types'
  const typeImport =
    'from ' + typesModule + ' import (\n    ' +
    typeNames.join(',\n    ') + ',\n)'

  const ff = Path.normalize(__dirname + '/../../../src/cmp/py/fragment/')

  // Entity files go to <name>_sdk/entity/ — inside the SDK package, not at
  // the language root. See the note in Main_py.ts: a top-level `entity`
  // package is shadowable by any entity.py sitting beside the caller.
  Folder({ name: model.const.Name.toLowerCase() + '_sdk' }, () => {
  Folder({ name: 'entity' }, () => {

    File({ name: entity.name + '_entity.' + target.ext }, () => {

      const opnames = Object.keys(entity.op || {})

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

          // Class token decoupled from the EntityName data-type token in
          // Entity.fragment.py so the class can be renamed independently.
          EntyClass: cls,

          // Literal-marker slot (jostraca's `#Name` tag pattern is hardcoded to
          // `//` comments, so Python uses a `# #`-prefixed literal like the op
          // frag slots) — fills in the typed-model import for this entity.
          '# #TypeImports': typeImport,

          // Feature-hook markers. jostraca's built-in `#Name-Tag` pattern is
          // hardcoded to `//` comments, so the Python fragment's
          // `# #<Name>-Hook` marker lines never matched it and the pipeline
          // hooks (PrePoint, PreRequest, ...) were silently dropped from the
          // generated op runner. Match the `#`-comment form explicitly.
          '/(?<indent>[ \\t]*)#[ \\t]*#(?<name>[A-Za-z0-9]+)-Hook[ \\t]*\\n?/':
            ({ name, indent }: any) =>
              `${indent}utility.feature_hook(ctx, "${name}")\n`,

          ...opfrags,
        }
      })

    })
  })
  })
})



export {
  Entity
}
