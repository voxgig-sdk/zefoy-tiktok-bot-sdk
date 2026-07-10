
import {
  cmp, camelify,
  Content, Fragment
} from '@voxgig/sdkgen'


const EntityOperation = cmp(function Operation(props: any) {
  const { model } = props.ctx$
  const { ff, opname, entity, entrep, cls } = props

  let { indent } = props

  if (null != indent) {
    indent = indent.substring(1)
    if ('' == indent) {
      indent = undefined
    }
  }

  const entop = entity.op[opname]

  Fragment({
    from: ff + '/Entity' + camelify(opname) + 'Op.fragment.lua',
    eject: ['-- EJECT-START', '-- EJECT-END'],
    indent,
    replace: {
      ...entrep,
      ProjectName: model.const.Name,
      EntityName: entity.Name,
      entityname: entity.name,

      // Class receiver token decoupled from the EntityName data-type token in
      // the Entity<Op>Op.fragment.lua files (receiver -> cls).
      EntyClass: cls,

      '#Feature-Hook': ({ name, indent }: any) =>
        Content({ indent }, `
u.feature_hook(ctx, "${name}")
`)

    }
  })
})


export {
  EntityOperation
}
