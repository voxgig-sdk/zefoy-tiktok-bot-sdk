
import * as Path from 'node:path'


import {
  File,
  Fragment,
  cmp,
} from '@voxgig/sdkgen'


import {
  Model,
} from '@voxgig/apidef'




const SdkError = cmp(async function SdkError(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  const ff = Path.normalize(__dirname + '/../../../src/cmp/js/fragment/')

  File({ name: model.const.Name + 'Error.' + target.ext }, () => {

    Fragment({
      from: ff + 'SdkError.fragment.js',

      replace: {
        ...ctx$.stdrep,
      }
    })
  })
})


export {
  SdkError
}
