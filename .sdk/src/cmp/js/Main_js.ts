
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


import { Package } from './Package_js'
import { Config } from './Config_js'
import { Gitignore } from './Gitignore_js'
import { MainEntity } from './MainEntity_js'
import { SdkError } from './SdkError_js'
import { EntityBase } from './EntityBase_js'


const Main = cmp(async function Main(props: any) {

  // Needs type: target object
  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  Package({ target })

  Gitignore({})

  Copy({
    from: 'tm/' + target.name,
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  Folder({ name: 'src' }, () => {

    SdkError({ target })

    File({ name: model.const.Name + 'SDK.' + target.name }, () => {

      Line(`// ${model.const.Name} ${target.Name} SDK\n`)

      List({ item: entity }, ({ item }: any) =>
        Line(`const { ${item.Name}Entity } = require('./entity/${item.Name}Entity')`))

      Fragment(
        {
          from: Path.normalize(__dirname + '/../../../src/cmp/js/fragment/Main.fragment.js'),
          replace: {
            ...props.ctx$.stdrep,

            '#BuildFeatures': ({ indent }: any) => {
              List({ item: feature, line: false }, ({ item }: any) =>
                Line({ indent },
                  `featureAdd(this._rootctx, new ${item.Name}Feature())`))
            },

            '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
fres = featureHook(ctx, '${name}')
if (fres instanceof Promise) { await fres }
`),

            '#TestOptions': ({ indent }: any) => {
              const topts = {
                feature: cmap(feature, {
                  active: false
                }),
              }
              Content({ indent },
                JSON.stringify(topts, null, 2)
                  .replace(/^{\n  /, '').replace(/\n}$/, ',\n').replace(/\n  /g, '\n'))
            }
          }
        },

        // Entities
        () => {
          each(entity, (entity: ModelEntity) => {
            const entitySDK = getModelPath(model, `main.${KIT}.entity.${entity.name}`)
            const entprops = { target, entity, entitySDK }
            MainEntity(entprops)
          })
        })
    })

    Config({ target })

    EntityBase({ target })

  })
})


export {
  Main
}
