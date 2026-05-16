
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_rb'
import { TestDirect } from './TestDirect_rb'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {

    // Generate exists test
    File({ name: 'exists_test.' + target.ext }, () => {
      Content(`# ${model.const.Name} SDK exists test

require "minitest/autorun"
require_relative "../${model.const.Name}_sdk"

class ExistsTest < Minitest::Test
  def test_create_test_sdk
    testsdk = ${model.const.Name}SDK.test(nil, nil)
    assert !testsdk.nil?
  end
end
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
