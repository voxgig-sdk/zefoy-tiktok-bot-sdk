
import * as Path from 'node:path'

import {
  cmp,
  File, Folder, Fragment,
} from '@voxgig/sdkgen'



const EntityBase = cmp(async function EntityBase(props: any) {

  // Needs type: target object
  const { target } = props
  const { model } = props.ctx$

  File({ name: model.const.Name + 'EntityBase.' + target.name }, () => {

    Fragment(
      {
        from:
          Path.normalize(__dirname + '/../../../src/cmp/ts/fragment/EntityBase.fragment.ts'),

        replace: {
          ...props.ctx$.stdrep,
        }
      })
  })
})


export {
  EntityBase
}
