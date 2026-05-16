
import {
  Content,
  File,
  cmp,
  each,
  omap,
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

  const sdkname = model.name
  const SdkName = nom(model, 'Name')
  const origin = null == model.origin ? '' : `@${model.origin}/`
  const sdknamesuffix = model.origin?.endsWith('-sdk') ? '' : '-sdk'

  // TODO: complete SDK meta data in model and use here
  const pkg = {
    name: `${origin}${sdkname}${sdknamesuffix}`,
    version: `0.0.1`,
    description: 'DESCRIPTION',
    main: `src/${SdkName}SDK.js`,
    type: 'commonjs',
    scripts: {
      'test': 'node --test \'test/**/*.test.js\'',
      'test-some': 'node --experimental-test-isolation=none ' +
        '--test-name-pattern=\"$TEST_PATTERN\" --test \'test/**/*.test.js\'',
      'test-utility': 'node --test test/utility/*.test.js',

      "clean": "rm -rf node_modules yarn.lock package-lock.json",
      "reset": "npm run clean && npm i && npm test",
    },
    author: `${SdkName}`,

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
