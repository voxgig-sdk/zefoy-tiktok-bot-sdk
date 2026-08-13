
import { Context } from '../types'


// GraphQL transport. API-INDEPENDENT: every GraphQL SDK this generator
// produces uses this file unchanged. The API-specific part — which
// operations exist and what each one's document is — is model data,
// computed once by apidef and emitted into Config.
//
// Two jobs:
//
//   graphqlBody    — build { query, variables } for a point, binding the
//                    op's arguments to the document's declared variables.
//
//   graphqlErrors  — lift a GraphQL failure into an SDK error. GraphQL
//                    reports failures as a top-level `errors` array under
//                    HTTP 200, so the status-driven path in resultBasic
//                    never sees them.


// Content type every GraphQL-over-HTTP request uses.
const GRAPHQL_CONTENT_TYPE = 'application/json'


// Map a GraphQL error to the same error codes the HTTP path produces, so a
// caller handles auth or rate limiting identically on both transports.
// Servers put the machine-readable code in `extensions.code`; Linear-style
// APIs use `extensions.type`.
function graphqlErrorCode(gqlerr: any): string {
  const ext = (null == gqlerr ? undefined : gqlerr.extensions) || {}
  const raw = String(ext.code || ext.type || '').toUpperCase()

  if (raw.includes('AUTH') || raw.includes('FORBIDDEN') ||
    raw.includes('UNAUTHENTICATED')) {
    return 'request_auth'
  }
  if (raw.includes('RATELIMIT') || raw.includes('RATE_LIMIT') ||
    raw.includes('TOO_MANY')) {
    return 'request_ratelimit'
  }
  if (raw.includes('BAD_USER_INPUT') || raw.includes('VALIDATION') ||
    raw.includes('INVALID')) {
    return 'request_invalid'
  }

  return 'request_graphql'
}


// Build the request body for a GraphQL point.
//
// Variables come from the op's own arguments: a named variable binds to the
// like-named argument (`from`), and the input-object variable (empty `from`)
// takes the request data as a whole — which is what makes a generated
// create/update call look exactly like its REST equivalent.
function graphqlBody(ctx: Context): any {
  const utility = ctx.utility
  const struct = utility.struct
  const getprop = struct.getprop

  const point: any = ctx.point
  const gql = null == point ? undefined : point.graphql

  if (null == gql) {
    return undefined
  }

  const op: any = ctx.op
  const input = null == op ? 'match' : op.input

  // reqmatch/reqdata hold the caller's arguments for this operation.
  const reqsrc = getprop(ctx, 'req' + input) || {}
  const datasrc = getprop(ctx, input) || {}

  const variables: Record<string, any> = {}

  for (const spec of (gql.vars || [])) {
    if ('' === spec.from || null == spec.from) {
      // The input object IS the request body. Strip the action selector,
      // which is an SDK-side point discriminator, not an API field.
      const body: Record<string, any> = {}
      for (const key of Object.keys(reqsrc)) {
        if ('$action' !== key) {
          body[key] = reqsrc[key]
        }
      }
      variables[spec.name] = body
    }
    else {
      const val = undefined !== getprop(reqsrc, spec.from) ?
        getprop(reqsrc, spec.from) : getprop(datasrc, spec.from)

      // Only send variables the caller actually supplied: sending an
      // explicit null would clear a field on many APIs.
      if (undefined !== val && null !== val) {
        variables[spec.name] = val
      }
    }
  }

  return {
    query: gql.doc,
    variables,
  }
}


// Inspect a decoded GraphQL response body and record a failure when the
// server reported one. Returns true when an error was recorded.
//
// Partial data (`data` alongside `errors`) is treated as failure: the REST
// surface has no partial-success concept, and silently returning half an
// object would be worse than failing. The raw envelope stays available on
// the result for callers that need it.
function graphqlErrors(ctx: Context): boolean {
  const result: any = ctx.result
  const point: any = ctx.point

  if (null == result || null == point || 'graphql' !== point.kind) {
    return false
  }

  const body: any = result.body
  const errors = null == body ? undefined : body.errors

  if (null == errors || !Array.isArray(errors) || 0 === errors.length) {
    return false
  }

  const first = errors[0]
  const msg = (null == first ? undefined : first.message) || 'graphql error'
  const code = graphqlErrorCode(first)

  const err: any = ctx.error(code,
    'graphql: ' + msg + (1 < errors.length ?
      ' (+' + (errors.length - 1) + ' more)' : ''))

  // Keep the full error list reachable for diagnostics.
  err.graphql = errors
  result.err = err
  result.ok = false

  return true
}


export {
  graphqlBody,
  graphqlErrors,
  graphqlErrorCode,
  GRAPHQL_CONTENT_TYPE,
}
