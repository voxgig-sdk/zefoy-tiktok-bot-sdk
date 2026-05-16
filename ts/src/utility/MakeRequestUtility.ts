
import { Context, Response, Result } from '../types'


async function makeRequest(ctx: Context): Promise<Response | Error> {
  // PreRequest feature hook has already provided a result.
  if (ctx.out.request) {
    return ctx.out.request
  }

  const spec = ctx.spec
  const utility = ctx.utility
  const fetcher = utility.fetcher
  const makeFetchDef = utility.makeFetchDef

  let response = new Response({})

  let result = new Result({})

  ctx.result = result

  if (null == spec) {
    return ctx.error('request_no_spec', 'Expected context spec property to be defined.')
  }


  try {
    const fetchdef = makeFetchDef(ctx)
    if (fetchdef instanceof Error) {
      throw fetchdef
    }

    if (ctx.ctrl.explain) {
      ctx.ctrl.explain.fetchdef = fetchdef
    }

    spec.step = 'prerequest'

    // TODO: see js code, use `native` prop here
    const fetched = await fetcher(ctx, fetchdef.url, fetchdef)

    if (null == fetched) {
      response = new Response({ err: ctx.error('request_no_response', 'response: undefined') })
    }
    else if (fetched instanceof Error) {
      response = new Response({ err: fetched })
    }
    else {
      response = new Response(fetched)
    }
  }
  catch (err) {
    response.err = err as Error
  }

  spec.step = 'postrequest'

  ctx.response = response

  return response
}


export {
  makeRequest
}
