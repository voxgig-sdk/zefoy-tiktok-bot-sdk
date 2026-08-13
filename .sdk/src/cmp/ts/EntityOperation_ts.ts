
import {
  cmp, camelify,
  Content, Fragment,
  entityClassName, entityCollection,
} from '@voxgig/sdkgen'


import { jsonify } from '@voxgig/struct'

import { formatJSONSrc, formatJson } from './utility_ts'


const EntityOperation = cmp(function Operation(props: any) {
  const { model } = props.ctx$
  const { ff, opname, entity, entrep } = props

  let { indent } = props

  indent = indent.substring(2)
  if ('' == indent) {
    indent = undefined
  }

  const entop = entity.op[opname]

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.ts',
    eject: ['// EJECT-START', '// EJECT-END'],
    indent,
    replace: {
      ...entrep,
      SdkName: model.const.Name,
      EntityName: entity.Name,
      entityname: entity.name,

      // The CLASS token. Operations resolve to the entity instance, so their
      // declared return type must name the class — `Promise<PlanetEntity>`,
      // not `Promise<Planet>` (the data interface). A signature that says
      // the data type while the call resolves to an entity is a lie the
      // compiler cannot catch; see AGENTS.md.
      EntyClass: entityClassName(entity, entityCollection(model)),
      "['POINTS']": formatJson(entop.points, { margin: 6 }).trim(),
      '#Feature-Hook': ({ name, indent }: any) =>
        Content({ indent }, `
fres = featureHook(ctx, '${name}')
if (fres instanceof Promise) { await fres }
`)

    }
  })
})


export {
  EntityOperation
}
