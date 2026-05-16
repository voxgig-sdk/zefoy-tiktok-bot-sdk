
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

  // Module name: concatenated lowercase (e.g., voxgigsolardemosdk)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  File({ name: 'go.mod' }, () => {
    Content(`module ${gomodule}

go 1.20

`)

    const deps: Record<string, string> = {}
    const replaceDirs: Record<string, string> = {}
    for (const d of collectDeps(model, target.name, target.deps)) {
      // Target-level deps default to 'v0.0.0' when version is absent;
      // feature deps require an explicit version.
      deps[d.name] = d.source === 'target' ? (d.version || 'v0.0.0') : d.version
      if (d.source === 'target' && d.raw?.replace) {
        replaceDirs[d.name] = d.raw.replace
      }
    }

    if (Object.keys(deps).length > 0) {
      Content(`require (
`)
      for (const [name, version] of Object.entries(deps)) {
        Content(`\t${name} ${version}
`)
      }
      Content(`)
`)
    }

    if (Object.keys(replaceDirs).length > 0) {
      Content(`
`)
      for (const [name, dir] of Object.entries(replaceDirs)) {
        Content(`replace ${name} => ${dir}
`)
      }
    }
  })
})


export {
  Package
}
