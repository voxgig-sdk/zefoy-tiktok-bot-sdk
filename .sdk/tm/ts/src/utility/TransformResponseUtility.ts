
import { Context } from '../types'


/* Convert data from respnse into a structure suitable for use as entity data.
 *
 * The operation (op) property `resform` is used to perform the data extraction.
 */
function transformResponse(ctx: Context) {
  const spec = ctx.spec
  const result = ctx.result
  const utility = ctx.utility
  const point = ctx.point
  const isfunc = utility.struct.isfunc
  const transform = utility.struct.transform

  if (spec) {
    spec.step = 'resform'
  }

  if (null == result || !result.ok) {
    return undefined
  }

  try {
    const resform = point.transform.res
    const resdata = isfunc(resform) ? resform(ctx) : transform(ctx.result, resform)
    result.resdata = resdata
    return resdata
  }
  catch (err) {
    return utility.makeError(ctx, err)
  }
}


export {
  transformResponse
}
