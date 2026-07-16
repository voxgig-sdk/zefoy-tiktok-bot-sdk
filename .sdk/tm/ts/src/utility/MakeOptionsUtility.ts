
import { Context } from '../types'


function makeOptions(ctx: Context) {
  const utility = ctx.utility
  const options = ctx.options
  const struct = utility.struct
  const items = struct.items
  const setprop = struct.setprop
  const merge = struct.merge
  const validate = struct.validate
  const escre = struct.escre

  let opts = { ...(options || {}) }

  // Feature add-order. `options.feature` may be given as an ordered ARRAY of
  // { name, active, ...opts } entries (the array position IS the order in
  // which features are added), or as a { name: {opts} } map. Normalize an
  // array to a map (so merge/validate/init are unchanged) and remember the
  // explicit order; a map defaults to test-first so the `test` mock transport
  // is installed as the base of the transport wrapper chain.
  let featureorder: string[] = []
  if (Array.isArray(opts.feature)) {
    const fmap: any = {}
    for (const entry of opts.feature) {
      if (null != entry && null != entry.name) {
        const { name, ...fopts } = entry
        fmap[name] = fopts
        featureorder.push(name)
      }
    }
    opts = { ...opts, feature: fmap }
  }

  const customUtils = opts.utility || {}
  for (let [key, val] of items(customUtils)) {
    setprop(utility, key, val)
  }

  let config = ctx.config || {}
  let cfgopts = config.options || {}

  // Standard SDK option values.
  const optspec = {
    apikey: '',
    base: 'http://localhost:8000',
    prefix: '',
    suffix: '',
    auth: {
      prefix: ''
    },
    headers: {
      '`$CHILD`': '`$STRING`'
    },
    allow: {
      method: 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
      op: 'create,update,load,list,remove,command,direct'
    },
    entity: {
      '`$CHILD`': {
        '`$OPEN`': true,
        active: false,
        alias: {}
      }
    },
    feature: {
      '`$CHILD`': {
        '`$OPEN`': true,
        active: false,
      }
    },
    utility: {},
    system: {
      fetch: undefined as any
    },
    test: {
      active: false,
      entity: {
        '`$OPEN`': true,
      }
    },
    clean: {
      keys: 'key,token,id'
    }
  }

  // JavaScript specific option values.
  optspec.system.fetch = opts.system?.fetch || global.fetch

  opts = merge([{}, cfgopts, opts])

  opts = validate(opts, optspec)

  // Resolve the feature add-order: an explicit array order (above) wins;
  // otherwise order the map test-first, then the remaining names sorted, so
  // the outcome is deterministic and `test` is always the base transport.
  if (0 === featureorder.length) {
    const names = Object.keys(opts.feature || {}).sort()
    featureorder = names.indexOf('test') < 0
      ? names
      : ['test'].concat(names.filter((n: string) => 'test' !== n))
  }

  opts.__derived__ = {
    clean: {
      keyre: undefined
    },
    featureorder,
  }

  const keyre = opts.clean.keys
    .split(/\s*,\s*/)
    .filter((s: string) => null != s && '' !== s)
    .map((key: string) => escre(key)).join('|')

  if ('' != keyre) {
    opts.__derived__.clean.keyre = keyre
  }

  return opts
}


export {
  makeOptions
}
