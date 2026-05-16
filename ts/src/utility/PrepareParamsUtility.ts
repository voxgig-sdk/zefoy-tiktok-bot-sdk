
import { Context } from '../types'


function prepareParams(ctx: Context) {
  const utility = ctx.utility
  const findparam = utility.param

  // const struct = utility.struct
  // const validate = struct.validate

  const point = ctx.point

  let params = point.args.params
  // let reqmatch = ctx.reqmatch

  params = params || []
  // reqmatch = reqmatch || {}

  let out: any = {}
  for (let pd of params) {
    let val = findparam(ctx, pd)
    if (null != val) {
      out[pd.name] = val
    }
  }

  // TODO: review
  // out = validate(out, point.validate.params)

  return out
}


export {
  prepareParams
}
