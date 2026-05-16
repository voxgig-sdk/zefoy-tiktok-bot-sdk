
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

  // Gem name is namespaced to model.origin (e.g. "voxgig-sdk"). RubyGems
  // names can't contain "/", so the parts are hyphen-joined. The require
  // path (`${model.name}_sdk`) is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const gemName = `${ns}-${pkgBase}`

  const versionOf = (d: { version: string; source: 'feature' | 'target' }) =>
    d.source === 'target' ? (d.version || '0.0') : d.version

  // Generate Gemfile
  File({ name: 'Gemfile' }, () => {
    Content(`source "https://rubygems.org"

gemspec

`)

    for (const d of collectDeps(model, target.name, target.deps)) {
      Content(`gem "${d.name}", "~> ${versionOf(d)}"
`)
    }
  })

  // Generate gemspec
  File({ name: model.const.Name + '_sdk.gemspec' }, () => {
    Content(`Gem::Specification.new do |spec|
  spec.name          = "${gemName}"
  spec.version       = "0.0.1"
  spec.authors       = ["Voxgig"]
  spec.summary       = "${model.const.Name} SDK for Ruby"
  spec.license       = "MIT"
  spec.homepage      = "https://github.com/${ns}/${model.name}-sdk"

  spec.files         = Dir["lib/**/*.rb", "*.rb"]
  spec.require_paths = ["."]

  spec.required_ruby_version = ">= 3.0"

  spec.add_dependency "json"
`)

    for (const d of collectDeps(model, target.name, target.deps)) {
      Content(`  spec.add_dependency "${d.name}", "~> ${versionOf(d)}"
`)
    }

    Content(`
  spec.add_development_dependency "minitest", "~> 5.0"
  spec.add_development_dependency "rake", "~> 13.0"
end
`)
  })
})


export {
  Package
}
