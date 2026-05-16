
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_php'
import { TestDirect } from './TestDirect_php'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  Folder({ name: 'test' }, () => {

    // Generate exists test
    File({ name: 'ExistsTest.' + target.ext }, () => {
      Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK exists test

require_once __DIR__ . '/../${model.const.Name.toLowerCase()}_sdk.php';

use PHPUnit\\Framework\\TestCase;

class ExistsTest extends TestCase
{
    public function test_create_test_sdk(): void
    {
        $testsdk = ${model.const.Name}SDK::test(null, null);
        $this->assertNotNull($testsdk);
    }
}
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
