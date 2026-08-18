
import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content, entityCollection } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_rb'
import { TestDirect } from './TestDirect_rb'
import { ReadmeExamplesTest } from './ReadmeExamplesTest_rb'


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

    const entity = each(entityCollection(model))
      .filter((e: any) => false !== e.active)

    each(entity, (entity: ModelEntity) => {
      TestEntity({ target, entity })
      TestDirect({ target, entity })
    })

    // README example snippet test (syntax + offline test-mode run).
    ReadmeExamplesTest({ target })
  })
})


export {
  Test
}
