
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


import { Package } from './Package_php'
import { Config } from './Config_php'
import { Gitignore } from './Gitignore_php'
import { MainEntity } from './MainEntity_php'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  Package({ target })

  Gitignore({})

  // Copy tm/php files with replacements
  Copy({
    from: 'tm/' + target.name,
    exclude: [/src\//],
    replace: {
      ...props.ctx$.stdrep,
    }
  })

  // Generate main SDK file
  File({ name: model.const.Name.toLowerCase() + '_sdk.' + target.ext }, () => {

    Fragment(
      {
        from: Path.normalize(__dirname + '/../../../src/cmp/php/fragment/Main.fragment.php'),
        replace: {
          ...props.ctx$.stdrep,

          '#BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  // feature: ${feat.name}
`)
            })
          },

          '#Feature-Hook': ({ name, indent }: any) => Content({ indent }, `
($utility->feature_hook)($this->_rootctx, "${name}");
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

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK feature factory

require_once __DIR__ . '/feature/BaseFeature.php';
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`require_once __DIR__ . '/feature/${fname}Feature.php';
`)
      }
    })

    Content(`

class ${model.const.Name}Features
{
    public static function make_feature(string $name)
    {
        switch ($name) {
            case "base":
                return new ${model.const.Name}BaseFeature();
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`            case "${feat.name}":
                return new ${model.const.Name}${fname}Feature();
`)
      }
    })

    Content(`            default:
                return new ${model.const.Name}BaseFeature();
        }
    }
}
`)
  })

})


export {
  Main
}
