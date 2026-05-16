
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder } from '@voxgig/sdkgen'


// import { Quick } from './Quick_ts'
// import { TestMain } from './TestMain_ts'
import { TestDirect } from './TestDirect_ts'
import { TestEntity } from './TestEntity_ts'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {
    // Quick({ target })
    // TestMain({ target })

    Folder({ name: 'entity' }, () => {
      each(model.main[KIT].entity, (entity: ModelEntity) => {
        TestEntity({ target, entity })
        TestDirect({ target, entity })
      })
    })
  })
})


export {
  Test
}
