
import {
  Content,
  File,
  cmp,
  collectDeps,
  pkgDescription,
  repoInfo, packageName,
  packageVersion,
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

  // Gem name is namespaced to model.origin (e.g. "voxgig-sdk"). RubyGems
  // names can't contain "/", so the parts are hyphen-joined. The require
  // path (`${model.name}_sdk`) is unchanged.
  const ns = model.origin || 'voxgig-sdk'
  const pkgBase = ns.endsWith('-sdk') ? model.name : `${model.name}-sdk`
  const gemName = packageName(model, target.name)
  const { repoUrl, issuesUrl, changelogUrl } = repoInfo(model)

  const versionOf = (d: { version: string; source: 'feature' | 'target' }) =>
    d.source === 'target' ? (d.version || '0.0') : d.version

  // Generate Gemfile
  File({ name: 'Gemfile' }, () => {
    Content(`source "https://rubygems.org"

gemspec

`)

    for (const d of collectDeps(model, target.name, target.deps, ctx$.log)) {
      Content(`gem "${d.name}", "~> ${versionOf(d)}"
`)
    }
  })

  // Generate gemspec
  File({ name: model.const.Name + '_sdk.gemspec' }, () => {
    // RubyGems rejects a gemspec that declares the same runtime dependency
    // twice (Gem::InvalidSpecificationException at `gem build`), so the
    // unconstrained json fallback is only emitted when the model's own
    // dependency list doesn't already declare json.
    const deps = collectDeps(model, target.name, target.deps, ctx$.log)
    const hasJson = deps.some((d: any) => 'json' === d.name)

    Content(`Gem::Specification.new do |spec|
  spec.name          = "${gemName}"
  spec.version       = "${packageVersion(model, target.name)}"
  spec.authors       = ["${author.name}"]
  spec.summary       = "${pkgDescription(model, target.name)}"
  spec.description   = "${pkgDescription(model, target.name)}"
  spec.license       = "MIT"
  spec.homepage      = "${repoUrl}"
  spec.metadata      = {
    "homepage_uri"          => "${repoUrl}",
    "source_code_uri"       => "${repoUrl}",
    "bug_tracker_uri"       => "${issuesUrl}",
    "changelog_uri"         => "${changelogUrl}",
    "rubygems_mfa_required" => "true"
  }

  spec.files         = Dir[
    "*.rb",
    "core/**/*.rb",
    "entity/**/*.rb",
    "feature/**/*.rb",
    "utility/**/*.rb",
    "LICENSE",
    "README.md",
    "REFERENCE.md"
  ]
  spec.require_paths = ["."]

  spec.required_ruby_version = ">= 3.0"
${hasJson ? '' : `
  spec.add_dependency "json"
`}`)

    for (const d of deps) {
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
