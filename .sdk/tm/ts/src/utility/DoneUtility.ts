
import { Context } from '../types'


import { clean } from './CleanUtility'


function done(ctx: Context) {
  const error = ctx.utility.makeError
  const delprop = ctx.utility.struct.delprop

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
    delprop(ctx.ctrl.explain.result, 'err')
  }

  if (ctx.result && ctx.result.ok) {
    return ctx.result.resdata
  }

  return error(ctx)
}


export {
  done
}
