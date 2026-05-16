
import {
  Content,
  File,
  cmp,
  collectDeps,
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

  File({ name: 'pyproject.toml' }, () => {
    Content(`[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${distName}"
version = "0.0.1"
description = "${model.const.Name} SDK for Python"
license = "MIT"
requires-python = ">=3.8"
dependencies = [
    "requests>=2.33",
`)

    for (const d of collectDeps(model, target.name, target.deps)) {
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`    "${d.name}>=${v}",
`)
    }

    Content(`]

[project.urls]
Homepage = "https://github.com/voxgig/${model.name}-sdk"

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
