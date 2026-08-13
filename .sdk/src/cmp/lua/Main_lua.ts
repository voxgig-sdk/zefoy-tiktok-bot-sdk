
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


import { Package } from './Package_lua'
import { Config } from './Config_lua'
import { Gitignore } from './Gitignore_lua'
import { MainEntity } from './MainEntity_lua'
import { EntityTypes } from './EntityTypes_lua'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  Package({ target })

  Gitignore({})

  // Copy tm/lua files with replacements
  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // Generate main SDK file
  File({ name: model.name + '_sdk.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/lua/fragment/Main.fragment.lua'),
        replace: {
          ...props.ctx$.stdrep,

          // Load the LuaLS typed-model annotations module so it is part of
          // the loaded program (module body is empty — no runtime effect) and
          // does not depend on workspace-wide language-server scanning.
          // NOTE: plain marker keys must EMBED the lua comment prefix
          // (`-- #X`) — jostraca's bare `#X` form only matches `//`-style
          // comment lines (cf. the `'-- #LoadOp'` keys in Entity_lua.ts).
          '-- #TypesRequire': ({ indent }: any) => Content({ indent },
            `-- Typed-model annotations (LuaLS ---@class); empty at runtime.\n` +
            `require("${model.name}_types")`),

          // Same embedded `-- ` prefix requirement as above (the bare
          // '#BuildFeatures' key never matched the lua comment line).
          '-- #BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  -- feature: ${feat.name}
`)
            })
          },

          '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
self._utility.feature_hook(self._rootctx, "${name}")
`),

        }
      },

      // Entities - injected at SLOT
      () => {
        each(entity, (entity: ModelEntity) => {
          const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
          const entprops = { target, entity, entitySDK }
          MainEntity(entprops)
        })
      })
  })

  // Generate typed-model annotations (LuaLS ---@class / ---@field)
  EntityTypes({ target })

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`-- ${model.const.Name} SDK feature factory

local BaseFeature = require("feature.base_feature")
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`local ${fname}Feature = require("feature.${feat.name}_feature")
`)
      }
    })

    Content(`

local features = {}

features.base = function()
  return BaseFeature.new()
end

`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`features["${feat.name}"] = function()
  return ${fname}Feature.new()
end

`)
      }
    })

    Content(`
return features
`)
  })

  // Generate _make_feature function referenced by Main.fragment.lua
  // This is part of the main SDK class, inserted via the slot

})


export {
  Main
}
