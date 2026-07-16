
import { Result, Context } from '../types'


import { clean } from './CleanUtility'

import { clone, delprop } from './StructUtility'


function makeError(ctx: Context, err?: any) {

  ctx = ctx || {}
  const op = ctx.op || {}
  op.name = op.name || 'unknown operation'


  const result = ctx.result || new Result({})
  result.ok = false

  const reserr = result.err

  err = undefined === err ? reserr : err
  err = err || ctx.error('unknown', 'unknown error')

  const errmsg = err.message || 'unknown error'
  // TODO: project name should come from config
  // avoids spurious changes between template and generated utility
  // applies for all utility files
  const msg = 'ZefoyTiktokBotSDK: ' + op.name + ': ' + errmsg
  err.message = clean(ctx, msg)

  if (result.err) {
    delprop(result, 'err')
  }

  const spec = ctx.spec || {}

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.err = {
      ...clone({ err }).err,
      message: err.message,
      stack: err.stack,
    }
  }

  err.result = clean(ctx, result)
  err.spec = clean(ctx, spec)

  ctx.ctrl.err = err

  // Fire PreUnexpected so observability features (metrics, telemetry, audit,
  // debug) close/record error paths that never reach PreDone (e.g. a PrePoint
  // rbac short-circuit). Fires after ctx.ctrl.err is set so hooks can read the
  // error; features guard against double-recording when PreDone already fired.
  if (null != ctx.client && null != ctx.utility &&
    'function' === typeof ctx.utility.featureHook) {
    ctx.utility.featureHook(ctx, 'PreUnexpected')
  }

  // TODO: model option to return instead
  if (false === ctx.ctrl.throw) {
    return result.resdata
  }
  else {
    throw err
  }
}


export {
  makeError
}
