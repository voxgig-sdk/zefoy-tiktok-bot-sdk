
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

  // Rock name is namespaced to model.origin (e.g. "voxgig-sdk"). LuaRocks has
  // no real namespaces, so the parts are hyphen-joined. The Lua module name
  // (`${model.name}_sdk`) used by `require` is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const rockName = `${ns}-${pkgBase}`

  // Single source for the version so the rockspec version and the source.tag
  // (which `make publish` pushes as lua/v<rockVersion>) can never drift apart.
  const rockVersion = '0.0.1'

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
  summary = "${model.const.Name} SDK for Lua",
  license = "MIT"
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
`)

    for (const d of collectDeps(model, target.name, target.deps)) {
      const v = d.source === 'target' ? (d.version || '0.0') : d.version
      Content(`  "${d.name} >= ${v}",
`)
    }

    Content(`}
build = {
  type = "builtin",
  modules = {
    ["${model.name}_sdk"] = "${model.name}_sdk.lua",
    ["config"] = "config.lua",
    ["features"] = "features.lua",
  }
}
`)
  })
})


export {
  Package
}
