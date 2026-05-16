
import { Result, Context } from '../types'


function makeResult(ctx: Context): Result | Error {
  // PreResult feature hook has already provided a result.
  if (ctx.out.result) {
    return ctx.out.result
  }

  const utility = ctx.utility
  const transformResponse = utility.transformResponse

  const op = ctx.op
  const entity = ctx.entity

  const spec = ctx.spec
  const result = ctx.result

  if (null == spec) {
    return ctx.error('result_no_spec', 'Expected context spec property to be defined.')
  }

  if (null == result) {
    return ctx.error('result_no_result', 'Expected context result property to be defined.')
  }

  spec.step = 'result'

  transformResponse(ctx)

  if ('list' == op.name) {
    const resdata = result.resdata
    result.resdata = []

    if (null != resdata && 0 < resdata.length) {
      for (let entry of resdata) {
        const ent = entity.make()
        ent.data(entry)
        result.resdata.push(ent)
      }
    }
  }

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.result = result
  }

  // NOTE: returns processesd result.
  return result
}


export {
  makeResult
}
