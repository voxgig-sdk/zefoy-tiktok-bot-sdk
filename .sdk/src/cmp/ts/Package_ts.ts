
import {
  Content,
  File,
  cmp,
  each,
  omap,
  packageName,
  pkgDescription,
  keywords,
  repoInfo,
  PUBLISHER,
  PUBLISHER_URL,
  packageVersion,
  authorInfo,
} from '@voxgig/sdkgen'


import {
  KIT,
  Model,
  getModelPath,
  nom,
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

  const feature = getModelPath(model, `main.${KIT}.feature`)

  const only = (kind: string, deps: any) =>
    omap(deps, ([k, v]: any) => [v.active && kind === v.kind ? k : undefined, v.version])

  // merge target and feature deps, by kind
  const deps =
    each(feature, (feature: any) =>
      omap(feature.deps?.[target.name], ([k, v]: any) =>
        [v.active ? k : undefined, v]))

      // TODO: sort by version; rules for version choice?
      // TODO: non-node dep kinds
      .reduce((a: any, deps: any) => (each(deps, (dep: any) =>
        a[dep.kind][dep.key$] = dep.version), a),
        {
          prod: only('prod', target.deps),
          peer: only('peer', target.deps),
          dev: only('dev', target.deps),
        })

  const SdkName = nom(model, 'Name')
  const { repoUrl, issuesUrl } = repoInfo(model)

  const pkg = {
    name: packageName(model, 'npm'),
    version: packageVersion(model, target.name),
    description: pkgDescription(model, target.name),
    keywords: keywords(model),
    homepage: `${repoUrl}#readme`,
    repository: { type: 'git', url: `git+${repoUrl}.git` },
    bugs: { url: issuesUrl },
    main: `dist/${SdkName}SDK.js`,
    type: 'commonjs',
    types: `dist/${SdkName}SDK.d.ts`,

    // What actually ships. Without `files`, `npm publish` packs everything
    // not gitignored — the test suite, dist-test/, the Makefile, the agent
    // guides — into the published tarball. `src` IS included: the emitted
    // .js.map files point back at it, so shipping it is what makes stack
    // traces in a consumer resolve to SDK source. README/LICENSE/package.json
    // are always included by npm and need no entry.
    files: ['dist', 'src'],
    scripts: {
      // `test` and `test-coverage` run the COMPILED suite in dist-test/, which
      // a fresh clone does not have — the glob then matches nothing and the
      // run reports "tests 0, pass 0, fail 0" and exits 0. A green suite that
      // asserted nothing is worse than a red one, so build first. npm runs a
      // `pre<script>` automatically, which keeps the test commands readable
      // and cannot be forgotten by a caller invoking `npm test` directly.
      'pretest': 'npm run build',
      'test': 'node --enable-source-maps --test-concurrency=1 --test \'dist-test/**/*.test.js\'',
      'test-some': 'node --enable-source-maps --experimental-test-isolation=none ' +
        '--test-name-pattern=\"$TEST_PATTERN\" --test \'dist-test/**/*.test.js\'',
      'test-utility': 'node --enable-source-maps --test test/utility/*.test.ts',

      // Coverage gate. Runs the same suite with V8 coverage (no source-maps,
      // so figures reflect true executed statements) over the SDK source
      // only (test files excluded) and fails when coverage drops below the
      // floor — protecting the runtime, utilities and features from silent
      // regressions. Thresholds are a conservative floor (well under a
      // healthy SDK's ~92% lines) so they hold across API shapes; raise them
      // for a stricter local policy.
      'pretest-coverage': 'npm run build',
      'test-coverage': 'node --test-concurrency=1 --experimental-test-coverage ' +
        '--test-coverage-exclude=\'**/dist-test/**\' ' +
        '--test-coverage-lines=85 --test-coverage-branches=68 --test-coverage-functions=88 ' +
        '--test \'dist-test/**/*.test.js\'',

      "watch": "tsc --build src test -w",
      // Prune compiled output before building: `tsc --build` is incremental and
      // never deletes .js for a removed source, so entity tests that the model
      // folds away would otherwise keep running from stale dist-test/ and fail.
      "build": "rm -rf dist dist-test && tsc --build src test",
      "clean": "rm -rf node_modules yarn.lock package-lock.json dist dist-test",
      "reset": "npm run clean && npm i && npm run build && npm test",
    },
    author,

    // TODO: needs to be config
    license: 'MIT',

    dependencies: deps.prod,
    peerDependencies: deps.peer,
    devDependencies: deps.dev,
  }

  File({ name: 'package.json' }, () => {
    Content(JSON.stringify(pkg, null, 2))
  })
})


export {
  Package
}
