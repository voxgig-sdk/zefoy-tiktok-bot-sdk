
import {
  Content,
  File,
  cmp,
  collectDeps, goModule, goVersion
} from '@voxgig/sdkgen'


import type {
  Model,
} from '@voxgig/apidef'


const Package = cmp(async function Package(props: any) {
  const ctx$ = props.ctx$
  const target = props.target

  const model: Model = ctx$.model

  // Module path and language version both come from the model — see
  // goModule / goVersion. Neither is derivable from the slug alone: the repo
  // may not be named `<slug>-sdk`, and the hardcoded `go 1.20` this used to
  // emit could not compile sdkgen's own `log` feature (it imports log/slog,
  // which needs 1.21).
  const gomodule = goModule(model, target.name)

  File({ name: 'go.mod' }, () => {
    Content(`module ${gomodule}

go ${goVersion(model, target.name)}

`)

    const deps: Record<string, string> = {}
    const replaceDirs: Record<string, string> = {}
    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
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
