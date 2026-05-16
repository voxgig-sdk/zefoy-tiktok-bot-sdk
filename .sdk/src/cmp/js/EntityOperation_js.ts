
import {
  cmp, camelify,
  Content, Fragment
} from '@voxgig/sdkgen'


import { jsonify } from '@voxgig/struct'

import { formatJSONSrc, formatJson } from './utility_js'


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
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.js',
    eject: ['// EJECT-START', '// EJECT-END'],
    indent,
    replace: {
      ...entrep,
      SdkName: model.const.Name,
      EntityName: entity.Name,
      entityname: entity.name,
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
