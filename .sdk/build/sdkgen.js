
const { SdkGen } = require('@voxgig/sdkgen')

const config = {
  root: __dirname+'/../dist/Root.js',
  folder: __dirname+'/../..',
  meta: {
    name: 'zefoy-tiktok-bot'
  },
  model: {
    folder: __dirname+'/../model',
  },
  // Overwrite generated SDK output, never 3-way merge: output is fully
  // model-derived and never hand-edited, and merging against a drifting
  // .jostraca base keeps stale files / injects <<<<<<< markers on toolchain
  // bumps. See @voxgig/sdkgen docs/explanation/regeneration-overwrite.md.
  existing: { txt: { write: true, merge: false } },
}

module.exports = SdkGen.makeBuild(config)
