
import { Context } from '../types'


function preparePath(ctx: Context) {
  const join = ctx.utility.struct.join
  const point = ctx.point

  const path = join(point.parts, '/', true)

  return path
}


export {
  preparePath
}
