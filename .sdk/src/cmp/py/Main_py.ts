
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


import { Package } from './Package_py'
import { Config } from './Config_py'
import { Gitignore } from './Gitignore_py'
import { MainEntity } from './MainEntity_py'


const Main = cmp(async function Main(props: any) {

  const { target } = props
  const { model } = props.ctx$

  const entity: ModelEntity = getModelPath(model, `main.${KIT}.entity`)
  const feature = getModelPath(model, `main.${KIT}.feature`)

  Package({ target })

  Gitignore({})

  // Copy tm/py files with replacements
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
        from: Path.normalize(__dirname + '/../../../src/cmp/py/fragment/Main.fragment.py'),
        replace: {
          ...props.ctx$.stdrep,

          '#BuildFeatures': ({ indent }: any) => {
            each(feature, (feat: any) => {
              const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
              Content({ indent }, `  # feature: ${feat.name}
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

  // Generate config module
  Folder({ name: '.' }, () => {
    Config({ target })
  })

  // Generate feature factory module
  File({ name: 'features.' + target.ext }, () => {
    Content(`# ${model.const.Name} SDK feature factory

from feature.base_feature import ${model.const.Name}BaseFeature
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`from feature.${feat.name}_feature import ${model.const.Name}${fname}Feature
`)
      }
    })

    Content(`

def _make_feature(name):
    features = {
        "base": lambda: ${model.const.Name}BaseFeature(),
`)

    each(feature, (feat: any) => {
      if (feat.name !== 'base') {
        const fname = feat.name.charAt(0).toUpperCase() + feat.name.slice(1)
        Content(`        "${feat.name}": lambda: ${model.const.Name}${fname}Feature(),
`)
      }
    })

    Content(`    }
    factory = features.get(name)
    if factory is not None:
        return factory()
    return features["base"]()
`)
  })

  // Generate __init__.py files for sub-packages.
  // NOTE: deliberately omit __init__.py at the language-root (py/) level —
  // making py/ a package collides with the third-party `py` module on PyPI
  // (a single-file `py.py`), which causes pytest to construct test module
  // paths as `py.test.<file>` and fail with "'py' is not a package".
  Folder({ name: 'core' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  Folder({ name: 'entity' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  Folder({ name: 'feature' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

  Folder({ name: 'utility' }, () => {
    File({ name: '__init__.' + target.ext }, () => {
      Content(``)
    })
  })

})


export {
  Main
}
