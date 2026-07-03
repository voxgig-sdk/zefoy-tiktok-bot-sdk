
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

  // PyPI distribution name is namespaced to model.origin (e.g. "voxgig-sdk").
  // PyPI names can't contain "/", so the parts are hyphen-joined. The import
  // package (the `${model.name}_sdk/` dir) is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const distName = `${ns}-${pkgBase}`
  const { repoUrl, issuesUrl } = repoInfo(model)
  const kw = keywords(model).map((k) => `"${k}"`).join(', ')

  File({ name: 'pyproject.toml' }, () => {
    Content(`[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${distName}"
version = "0.0.1"
description = "${pkgDescription(model, 'py')}"
readme = "README.md"
license = "MIT"
requires-python = ">=3.8"
keywords = [${kw}]
dependencies = [
`)

    const seen = new Set<string>()
    for (const d of collectDeps(model, target.name, target.deps)) {
      if (seen.has(d.name)) continue
      seen.add(d.name)
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`    "${d.name}>=${v}",
`)
    }

    Content(`]

[project.urls]
Homepage = "${repoUrl}"
Repository = "${repoUrl}"
Issues = "${issuesUrl}"

# Explicit package list — setuptools auto-discovery refuses to pick when
# multiple top-level dirs (core/entity/feature/utility) are present.
[tool.setuptools.packages.find]
include = ["core*", "entity*", "feature*", "utility*"]
`)
  })
})


export {
  Package
}
