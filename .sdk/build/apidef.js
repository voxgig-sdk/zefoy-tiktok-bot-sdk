
const { ApiDef } = require('@voxgig/apidef')

const opts = {
  folder: __dirname + '/../model',
}

module.exports = ApiDef.makeBuild(opts)
