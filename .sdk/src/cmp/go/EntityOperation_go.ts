
import {
  cmp, camelify,
  Content, Fragment
} from '@voxgig/sdkgen'


import { formatGoMap } from './utility_go'


const EntityOperation = cmp(function Operation(props: any) {
  const { model } = props.ctx$
  const { ff, opname, entity, entrep, gomodule, cls } = props

  let { indent } = props

  if (null != indent) {
    indent = indent.substring(1)
    if ('' == indent) {
      indent = undefined
    }
  }

  const entop = entity.op[opname]

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.go',
    eject: ['// EJECT-START', '// EJECT-END'],
    indent,
    replace: {
      ...entrep,
      'GOMODULE': gomodule,
      '"github.com/voxgig/struct"': `"${gomodule}/utility/struct"`,
      ProjectName: model.const.Name,
      EntityName: entity.Name,
      entityname: entity.name,

      // Class receiver tokens are decoupled from the EntityName data-type token
      // in the Entity<Op>Op.fragment.go files (receiver -> cls; the per-op
      // EntityName<Op>Match/Data data types stay derived from EntityName).
      EntyClass: cls,
      NewEntyClass: 'New' + cls,

      '#Feature-Hook': ({ name, indent }: any) =>
        Content({ indent }, `
u.FeatureHook(ctx, "${name}")
`)

    }
  })
})


export {
  EntityOperation
}
