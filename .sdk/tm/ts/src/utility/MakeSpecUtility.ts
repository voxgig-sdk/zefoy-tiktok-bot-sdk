
import { Context, Spec } from '../types'


// Create request specificaton.
function makeSpec(ctx: Context): Spec | Error {
  if (ctx.out.spec) {
    return ctx.spec = ctx.out.spec
  }

  const point = ctx.point
  const options = ctx.options
  const utility = ctx.utility

  const prepareMethod = utility.prepareMethod
  const prepareParams = utility.prepareParams
  const prepareQuery = utility.prepareQuery
  const prepareHeaders = utility.prepareHeaders
  const prepareBody = utility.prepareBody
  const preparePath = utility.preparePath
  const prepareAuth = utility.prepareAuth

  ctx.spec = new Spec({
    base: options.base, // string, URL endpoint base prefix,
    prefix: options.prefix,
    parts: point.parts,
    suffix: options.suffix,
    step: 'start',
  })

  ctx.spec.method = prepareMethod(ctx)

  // TODO: Add string utils to StructUtility
  if (!options.allow.method.includes(ctx.spec.method)) {
    return ctx.error('spec_method_allow', 'Method "' + ctx.spec.method +
      '" not allowed by SDK option allow.method value: "' + options.allow.method + '"')
  }

  ctx.spec.params = prepareParams(ctx)
  ctx.spec.query = prepareQuery(ctx)
  ctx.spec.headers = prepareHeaders(ctx)

  if ('graphql' === (point as any).kind) {
    // GraphQL addresses one endpoint: no path parts, no query string, and
    // the body carries the operation. prepareBody is skipped deliberately —
    // it only emits a body for data-input ops (create/update), whereas every
    // GraphQL op posts one, including load/list/remove.
    ctx.spec.body = utility.graphqlBody(ctx)
    ctx.spec.path = ''
    // prepareQuery already copied the op's match arguments into the query
    // string. Those same values are bound as operation variables, so leaving
    // them would send /graphql?id=i1 — duplicating the argument, leaking it
    // into the URL, and failing servers that reject unknown query params.
    ctx.spec.query = {}
    ctx.spec.headers['content-type'] = utility.GRAPHQL_CONTENT_TYPE
  }
  else {
    ctx.spec.body = prepareBody(ctx)
    ctx.spec.path = preparePath(ctx)
  }

  if (ctx.ctrl.explain) {
    ctx.ctrl.explain.spec = ctx.spec
  }

  const spec = prepareAuth(ctx)

  if (!(spec instanceof Error)) {
    ctx.spec = spec
  }

  return spec
}


export {
  makeSpec
}
