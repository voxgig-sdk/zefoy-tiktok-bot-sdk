
import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, entityCollection } from '@voxgig/sdkgen'


// import { Quick } from './Quick_ts'
// import { TestMain } from './TestMain_ts'
import { TestDirect } from './TestDirect_ts'
import { TestEntity } from './TestEntity_ts'
import { ReadmeExampleTest } from './ReadmeExampleTest_ts'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_ts'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {
    // Quick({ target })
    // TestMain({ target })

    ReadmeExampleTest({ target })
    ReadmeExamplesTest({ target })

    Folder({ name: 'entity' }, () => {
      // entityCollection is the cached, UNFILTERED collection (AGENTS.md), so
      // the active filter the raw model read this replaced never applied is
      // written out here. Tests follow Main: an inactive entity has no source.
      const entity = each(entityCollection(model))
        .filter((e: any) => false !== e.active)

      each(entity, (entity: ModelEntity) => {
        TestEntity({ target, entity })
        TestDirect({ target, entity })
      })
    })
  })
})


export {
  Test
}
