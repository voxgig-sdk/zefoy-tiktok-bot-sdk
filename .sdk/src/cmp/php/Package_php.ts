
import {
  Content,
  File,
  cmp,
  collectDeps,
  pkgDescription,
  keywords,
  repoInfo, packageName,
  authorInfo,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // WHO WROTE THIS PACKAGE. Per target, falling back to the model-wide value
  // and then to the publisher — so a manifest cannot go on naming Voxgig
  // while the model names someone else, which is exactly what the hardcoded
  // constant here did.
  const author = authorInfo(model, target.name)

  // Package namespace mirrors the npm scope (model.origin, e.g. "voxgig-sdk").
  // If origin already ends in "-sdk" the slug stands alone; otherwise append
  // "-sdk" (matches the TS Package generator).
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const { repoUrl, issuesUrl } = repoInfo(model)
  const kw = keywords(model).map((k) => `"${k}"`).join(', ')

  // Generate composer.json
  File({ name: 'composer.json' }, () => {
    Content(`{
  "name": "${packageName(model, target.name)}",
  "description": "${pkgDescription(model, target.name)}",
  "type": "library",
  "keywords": [${kw}],
  "homepage": "${repoUrl}",
  "license": "MIT",
  "authors": [
    { "name": "${author.name}"${'' === author.url ? '' : `, "homepage": "${author.url}"`} }
  ],
  "support": {
    "issues": "${issuesUrl}",
    "source": "${repoUrl}"
  },
  "minimum-stability": "stable",
  "require": {
    "php": ">=8.2"`)

    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`,
    "${d.name}": "^${v}"`)
    }

    Content(`
  },
  "require-dev": {
    "phpunit/phpunit": "^11.0"
  },
  "autoload": {
    "files": ["${model.const.Name.toLowerCase()}_sdk.php"],
    "classmap": ["core/", "entity/", "feature/", "types/", "utility/", "config.php", "features.php"]
  },
  "autoload-dev": {
    "classmap": ["test/"]
  }
}
`)
  })
})


export {
  Package
}
