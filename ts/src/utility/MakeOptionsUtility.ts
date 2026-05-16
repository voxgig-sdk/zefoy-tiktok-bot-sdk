
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

  opts.__derived__ = {
    clean: {
      keyre: undefined
    }
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
