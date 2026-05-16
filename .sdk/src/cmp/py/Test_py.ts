
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_py'
import { TestDirect } from './TestDirect_py'


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
      Content(`# ProjectName SDK exists test

import pytest
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK


class TestExists:

    def test_should_create_test_sdk(self):
        testsdk = ${model.const.Name}SDK.test(None, None)
        assert testsdk is not None
`)
    })

    each(model.main[KIT].entity, (entity: ModelEntity) => {
      TestEntity({ target, entity })
      TestDirect({ target, entity })
    })
  })
})


export {
  Test
}
