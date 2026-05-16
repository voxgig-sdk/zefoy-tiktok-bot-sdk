
import { Context } from '../types'


function resultHeaders(ctx: Context) {
  const response = ctx.response
  const result = ctx.result

  if (result) {
    if (response && response.headers && response.headers.forEach) {
      const headers: any = {}
      response.headers.forEach((v: any, k: any) => headers[k] = v)
      result.headers = headers
    }
    else {
      result.headers = {}
    }
  }

  return result
}


export {
  resultHeaders
}
