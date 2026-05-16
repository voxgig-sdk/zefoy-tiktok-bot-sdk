
import {
  KIT,
  getModelPath
} from '@voxgig/apidef'

import type {
  ModelEntity
} from '@voxgig/apidef'

import { cmp, each, Folder, File, Content } from '@voxgig/sdkgen'


import { TestEntity } from './TestEntity_go'
import { TestDirect } from './TestDirect_go'


const Test = cmp(function Test(props: any) {
  const { model, stdrep } = props.ctx$
  const { target } = props

  // Module name: concatenated lowercase
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  Folder({ name: 'test' }, () => {

    // Generate exists_test.go programmatically to avoid duplication
    // with any scaffolded test file (e.g. projectname_sdk_test.go).
    File({ name: 'exists_test.' + target.ext }, () => {
      Content(`package sdktest

import (
	"testing"

	sdk "${gomodule}"
)

func TestExists(t *testing.T) {
	t.Run("test-mode", func(t *testing.T) {
		testsdk := sdk.TestSDK(nil, nil)
		if testsdk == nil {
			t.Fatal("expected non-nil SDK")
		}
	})
}
`)
    })

    each(model.main[KIT].entity, (entity: ModelEntity) => {
      TestEntity({ target, entity, gomodule })
      TestDirect({ target, entity, gomodule })
    })
  })
})


export {
  Test
}
