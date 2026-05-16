
import * as Path from 'node:path'

import {
  cmp, each, names, cmap,
  List, File, Content, Copy, Folder, Fragment, Line, FeatureHook,
} from '@voxgig/sdkgen'


import type {
  ModelEntity
} from '@voxgig/apidef'


import {
  KIT,
  getModelPath
} from '@voxgig/apidef'


import { Package } from './Package_go'
import { Config } from './Config_go'
import { Gitignore } from './Gitignore_go'
import { MainEntity } from './MainEntity_go'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  // Go module path == the repo path on GitHub (org from model.origin),
  // e.g. github.com/voxgig-sdk/<slug>-sdk. Used in go.mod and every import.
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`
  // The root package name must be a plain Go identifier (can't be a path),
  // so it stays as the concatenated-lowercase form (e.g. voxgigdogsdk).
  const gopackage = (model.origin || 'voxgig-sdk').replace(/-sdk$/, '').replace(/[^a-z0-9]/gi, '') +
    model.name.replace(/[^a-z0-9]/gi, '').toLowerCase() + 'sdk'

  Package({ target })

  Gitignore({})

  // Copy tm/go files with replacements
  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//],
    replace: {
      ...props.ctx$.stdrep,
      GOMODULE: gomodule,
    }
  })

  // Generate main SDK file in core/ folder
  Folder({ name: 'core' }, () => {

    File({ name: model.name + '_sdk.' + target.ext }, () => {

      Fragment(
        {
          from: Path.normalize(__dirname + '/../../../src/cmp/go/fragment/Main.fragment.go'),
          replace: {
            ...props.ctx$.stdrep,
            'ProjectNameModule': gomodule,

            '#BuildFeatures': ({ indent }: any) => {
              each(feature, (feat: any) => {
                const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
                Content({ indent }, `u.FeatureAdd(s.rootctx, New${fname}FeatureFunc())
`)
              })
            },

            '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
s.utility.FeatureHook(s.rootctx, "${name}")
`),

          }
        },

        // Entities - injected at SLOT
        () => {
          each(entity, (entity: ModelEntity) => {
            const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
            const entprops = { target, entity, entitySDK, gomodule }
            MainEntity(entprops)
          })
        })
    })

    Config({ target })

    // Generate registry.go with all constructor function vars
    File({ name: 'registry.' + target.ext }, () => {
      Content(`package core

var UtilityRegistrar func(u *Utility)

var NewBaseFeatureFunc func() Feature

`)
      // Feature constructor function vars (non-base)
      each(feature, (feat: any) => {
        if (feat.name !== 'base') {
          const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
          Content(`var New${fname}FeatureFunc func() Feature

`)
        }
      })

      // Entity constructor function vars
      each(entity, (ent: any) => {
        Content(`var New${ent.Name}EntityFunc func(client *${model.const.Name}SDK, entopts map[string]any) ${model.const.Name}Entity

`)
      })
    })
  })

  // Generate root package file
  const hasEntities = Object.keys(entity || {}).length > 0
  const entityImport = hasEntities ? `\n\t"${gomodule}/entity"` : ''
  File({ name: model.name + '.' + target.ext }, () => {
    Content(`package ${gopackage}

import (
	"${gomodule}/core"${entityImport}
	"${gomodule}/feature"
	_ "${gomodule}/utility"
)

// Type aliases preserve external API.
type ${model.const.Name}SDK = core.${model.const.Name}SDK
type Context = core.Context
type Utility = core.Utility
type Feature = core.Feature
type Entity = core.Entity
type ${model.const.Name}Entity = core.${model.const.Name}Entity
type FetcherFunc = core.FetcherFunc
type Spec = core.Spec
type Result = core.Result
type Response = core.Response
type Operation = core.Operation
type Control = core.Control
type ${model.const.Name}Error = core.${model.const.Name}Error

// BaseFeature from feature package.
type BaseFeature = feature.BaseFeature

func init() {
`)

    // Register feature constructors - base is always present
    Content(`	core.NewBaseFeatureFunc = func() core.Feature {
		return feature.NewBaseFeature()
	}
`)

    // Register non-base feature constructors
    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`	core.New${fname}FeatureFunc = func() core.Feature {
		return feature.New${fname}Feature()
	}
`)
      }
    })

    // Register entity constructors
    each(entity, (ent: any) => {
      Content(`	core.New${ent.Name}EntityFunc = func(client *core.${model.const.Name}SDK, entopts map[string]any) core.${model.const.Name}Entity {
		return entity.New${ent.Name}Entity(client, entopts)
	}
`)
    })

    Content(`}

// Constructor re-exports.
var New${model.const.Name}SDK = core.New${model.const.Name}SDK
var TestSDK = core.TestSDK
var NewContext = core.NewContext
var NewSpec = core.NewSpec
var NewResult = core.NewResult
var NewResponse = core.NewResponse
var NewOperation = core.NewOperation
var MakeConfig = core.MakeConfig
`)

    // Feature constructor re-exports - base is always present
    Content(`var NewBaseFeature = feature.NewBaseFeature
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`var New${fname}Feature = feature.New${fname}Feature
`)
      }
    })
  })

})


export {
  Main
}
