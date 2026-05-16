
import { Context } from '../types'


function makeUrl(ctx: Context): Error | string {
  const utility = ctx.utility
  const spec = ctx.spec
  const result = ctx.result

  const struct = utility.struct
  const escurl = struct.escurl
  const escre = struct.escre
  const join = struct.join
  const items = struct.items


  if (null == spec) {
    return ctx.error('url_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == result) {
    return ctx.error('url_no_result', 'Expected context result property to be defined.')
  }


  // TODO: use parts to avoid regexp?
  let url = join([spec.base, spec.prefix, spec.path, spec.suffix], '/', true)
  let resmatch: Record<string, any> = {}

  const params = spec.params

  for (let [key, val] of items(params)) {
    if (null != val) {
      url = url.replace(RegExp('{' + escre(key) + '}'), escurl(val))
      resmatch[key] = val
    }
  }


  // Append query string from spec.query. Entity ops populate this via
  // PrepareQueryUtility from the operation's reqmatch; direct() callers
  // pass it as fetchargs.query.
  let qsep = '?'
  for (let [key, val] of items(spec.query)) {
    if (null != val) {
      url += qsep + escurl(key) + '=' + escurl(val)
      qsep = '&'
      resmatch[key] = val
    }
  }

  result.resmatch = resmatch

  return url
}


export {
  makeUrl
}
