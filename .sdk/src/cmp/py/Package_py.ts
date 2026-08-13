
import {
  Content,
  File,
  cmp,
  collectDeps,
  pkgDescription,
  keywords,
  repoInfo, packageName,
  packageVersion
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
  const distName = packageName(model, 'py')
  const { repoUrl, issuesUrl } = repoInfo(model)
  const kw = keywords(model).map((k) => `"${k}"`).join(', ')

  File({ name: 'pyproject.toml' }, () => {
    Content(`[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "${distName}"
version = "${packageVersion(model, target.name)}"
description = "${pkgDescription(model, 'py')}"
readme = "README.md"
license = "MIT"
requires-python = ">=3.8"
keywords = [${kw}]
dependencies = [
`)

    const seen = new Set<string>()
    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
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

# ONE package. core/entity/feature/utility were previously top-level packages;
# those names are real PyPI distributions and common scratch filenames, and
# Python searches the working directory first, so any of them beside the
# caller silently shadowed the SDK's own. They now live inside
# ${model.const.Name.toLowerCase()}_sdk/ where nothing can reach them.
[tool.setuptools.packages.find]
include = ["${model.const.Name.toLowerCase()}_sdk*"]

# Ship the PEP 561 py.typed marker(s) so the inline type hints reach consumers.
[tool.setuptools.package-data]
"*" = ["py.typed"]
`)
  })
})


export {
  Package
}
