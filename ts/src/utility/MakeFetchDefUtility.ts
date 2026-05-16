
import { Context, Result } from '../types'


function makeFetchDef(ctx: Context): any | Error {
  const spec = ctx.spec
  const utility = ctx.utility
  const makeUrl = utility.makeUrl
  const struct = utility.struct
  const jsonify = struct.jsonify

  if (null == spec) {
    return ctx.error('fetchdef_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == ctx.result) {
    ctx.result = new Result({})
  }

  spec.step = 'prepare'

  const url = makeUrl(ctx)
  if (url instanceof Error) {
    return url
  }

  spec.url = url

  const fetchdef: any = {
    url,
    method: spec.method,
    headers: spec.headers,
  }

  if (null != spec.body) {
    fetchdef.body =
      'object' === typeof spec.body ? jsonify(spec.body) : spec.body
  }

  return fetchdef
}


export {
  makeFetchDef
}
