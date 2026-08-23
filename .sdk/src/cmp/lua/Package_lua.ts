
import {
  Content,
  File,
  cmp,
  collectDeps,
  each,
  pkgDescription,
  keywords,
  repoInfo, packageName,
  packageVersion,
} from '@voxgig/sdkgen'


import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'

import type {
  Model,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // Rock name is namespaced to model.origin (e.g. "voxgig-sdk"). LuaRocks has
  // no real namespaces, so the parts are hyphen-joined. The Lua module name
  // (`${model.name}_sdk`) used by `require` is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const rockName = packageName(model, target.name)
  const { repoUrl, issuesUrl } = repoInfo(model)
  const labels = keywords(model).map((k) => `"${k}"`).join(', ')

  // Single source for the version so the rockspec version and the source.tag
  // (which `make publish` pushes as lua/v<rockVersion>) can never drift apart.
  const rockVersion = packageVersion(model, target.name)

  File({ name: model.name + '.rockspec' }, () => {
    Content(`package = "${rockName}"
version = "${rockVersion}-1"
source = {
  -- git+https (GitHub dropped git:// in 2022); pin the install to the release
  -- tag pushed by \`make publish\`, and point at the lua/ subdir of the monorepo.
  url = "git+https://github.com/${ns}/${model.name}-sdk.git",
  tag = "lua/v${rockVersion}",
  dir = "${model.name}-sdk/lua"
}
description = {
  summary = "${pkgDescription(model, target.name)}",
  homepage = "${repoUrl}",
  issues_url = "${issuesUrl}",
  license = "MIT",
  labels = { ${labels} }
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
`)

    const seen = new Set<string>(['lua', 'dkjson'])
    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
      if (seen.has(d.name)) continue
      seen.add(d.name)
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`  "${d.name} >= ${v}",
`)
    }

    // Feature modules must be listed too, or an install-from-rock ships a
    // features.lua whose requires cannot resolve. Emitted from the model
    // (each = sorted order, byte-stable), plus the base feature every
    // factory falls back to. The station feature additionally carries the
    // VENDORED voxgig_station library beside its adapter (no voxgig-station
    // rock exists to depend on - station design 9.2's registry-less tier).
    const feature = getModelPath(model, `main.${KIT}.feature`)
    let featureModules = `    ["feature.base_feature"] = "feature/base_feature.lua",\n`
    each(feature, (f: any) => {
      featureModules +=
        `    ["feature.${f.name}_feature"] = "feature/${f.name}_feature.lua",\n`
      if ('station' === f.name) {
        featureModules +=
          `    ["feature.station.voxgig_station"] = "feature/station/voxgig_station.lua",\n`
      }
    })

    Content(`}
build = {
  type = "builtin",
  modules = {
    ["${model.name}_sdk"] = "${model.name}_sdk.lua",
    ["config"] = "config.lua",
    ["config_shared"] = "config_shared.lua",
    ["features"] = "features.lua",
${featureModules}  }
}
`)
  })
})


export {
  Package
}
