
import {
  Content,
  File,
  cmp,
  collectDeps,
  pkgDescription,
  keywords,
  repoInfo,
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

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
  "name": "${ns}/${pkgBase}",
  "description": "${pkgDescription(model, 'php')}",
  "type": "library",
  "keywords": [${kw}],
  "homepage": "${repoUrl}",
  "license": "MIT",
  "authors": [
    { "name": "Voxgig", "homepage": "https://voxgig.com" }
  ],
  "support": {
    "issues": "${issuesUrl}",
    "source": "${repoUrl}"
  },
  "minimum-stability": "stable",
  "require": {
    "php": ">=8.2"`)

    for (const d of collectDeps(model, target.name, target.deps)) {
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
    "psr-4": {
      "${model.const.Name}\\\\": "src/"
    }
  },
  "autoload-dev": {
    "psr-4": {
      "${model.const.Name}\\\\Tests\\\\": "test/"
    }
  }
}
`)
  })
})


export {
  Package
}
