
import { Context } from '../types'

function prepareBody(ctx: Context) {
  const op = ctx.op

  const utility = ctx.utility
  const error = utility.makeError
  const transformRequest = utility.transformRequest

  let body = undefined

  if ('data' === op.input) {
    try {
      body = transformRequest(ctx)

      // if (point.check.nobody && null == body) {
      //   return error(ctx, new Error('Request body is empty.'))
      // }
    }
    catch (err) {
      return error(ctx, err)
    }
  }

  return body
}

export {
  prepareBody
}

