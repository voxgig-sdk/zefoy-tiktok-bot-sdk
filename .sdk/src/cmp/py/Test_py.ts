
import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content, entityCollection } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_py'
import { TestDirect } from './TestDirect_py'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_py'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {

    // Generate __init__.py for test package
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })

    // Generate exists test
    File({ name: 'test_exists.' + target.ext }, () => {
      // The header names the SDK like every other line here — a literal
      // `ProjectName` is the raw placeholder, not a substituted value: Content
      // does not apply the standard replacements.
      Content(`# ${model.const.Name} SDK exists test

import pytest
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK


class TestExists:

    def test_should_create_test_sdk(self):
        testsdk = ${model.const.Name}SDK.test(None, None)
        assert testsdk is not None
`)
    })

    const entity = each(entityCollection(model))
      .filter((e: any) => false !== e.active)

    each(entity, (entity: ModelEntity) => {
      TestEntity({ target, entity })
      TestDirect({ target, entity })
    })

    // Validate the documented python examples in the root README.
    ReadmeExamplesTest({ target })
  })
})


export {
  Test
}
