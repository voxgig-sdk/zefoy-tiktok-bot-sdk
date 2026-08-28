
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
    secret: '',
    base: 'http://localhost:8000',
    prefix: '',
    suffix: '',
    auth: {
      prefix: '',
      basic: false
    },
    headers: {
      '`$CHILD`': '`$STRING`'
    },
    allow: {
      method: 'GET,PUT,POST,PATCH,DELETE,OPTIONS',
      op: 'create,update,load,list,remove,command,direct,graphql'
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
    // Feature INSTANCES supplied at construction (the station adopt
    // path): consumed by the constructor's featureAdd loop, so they are
    // class instances, not data - `$ANY` accepts them verbatim. Without
    // this entry the seam is dead: the constructor reads
    // options.extend, but validate rejected the key.
    extend: '`$ANY`' as any,
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
    },
    // Server-variable values for a templated base URL (OpenAPI server
    // variables): `{name}` placeholders in `base` are substituted from
    // this map at construction. Spec defaults arrive via the generated
    // Config; user values override them.
    server: {
      '`$CHILD`': ''
    }
  }

  // JavaScript specific option values.
  optspec.system.fetch = opts.system?.fetch || global.fetch

  // Clone the config side before merging: `config` is a module-level
  // singleton in ts/js, and merge would otherwise use its nested maps as
  // merge TARGETS — one instance's options (server, headers, ...) would
  // contaminate every instance constructed after it.
  opts = merge([{}, struct.clone(cfgopts), opts])

  opts = validate(opts, optspec)

  // Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
  // Every placeholder must resolve to a non-empty value: from
  // options.server (user), else the Config default. A placeholder that
  // resolves to '' is a construction ERROR in live mode — the URL cannot
  // work — but in test mode substitutes the deterministic value
  // `test-<name>` so offline tests need no configuration.
  if ('string' === typeof opts.base && opts.base.includes('{')) {
    const testmode = true === opts.test.active ||
      true === (opts.feature && opts.feature.test && opts.feature.test.active)
    const server = opts.server || {}
    opts.base = opts.base.replace(/\{([A-Za-z0-9_]+)\}/g,
      (_m: string, name: string) => {
        let val = server[name]
        val = 'string' === typeof val ? val : ''
        if ('' === val) {
          if (testmode) {
            return 'test-' + name
          }
          throw new Error(
            `${config?.main?.name || 'SDK'}: the server variable '${name}' is required: ` +
            `the API base URL is '${opts.base}' — pass { server: { ${name}: '...' } } ` +
            `in the SDK options`)
        }
        return val
      })
  }

  // Resolve the feature add-order: an explicit array order (above) wins;
  // otherwise order the map test-first, then the remaining names sorted, so
  // the outcome is deterministic and `test` is always the base transport.
  if (0 === featureorder.length) {
    let names = Object.keys(opts.feature || {}).sort()
    names = names.indexOf('test') < 0
      ? names
      : ['test'].concat(names.filter((n: string) => 'test' !== n))
    // Station special case, mirroring test's: its transport wrap must
    // sit immediately outside the base transport (inside retry/cache/
    // netsim), so map-form activation hoists it to just after test -
    // or first, when no test entry exists. Without this the sorted
    // default would init station last and wrap OUTSIDE the recording
    // features, turning its wire-truth events into fiction.
    const si = names.indexOf('station')
    if (0 <= si) {
      names.splice(si, 1)
      names.splice(names.indexOf('test') + 1, 0, 'station')
    }
    featureorder = names
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
