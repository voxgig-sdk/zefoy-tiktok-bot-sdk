# ZefoyTiktokBot SDK utility: graphql
#
# GraphQL transport. API-INDEPENDENT: every GraphQL SDK this generator
# produces uses this file unchanged. The API-specific part — which
# operations exist and what each one's document is — is model data,
# computed once by apidef and emitted into Config.
#
# Two jobs:
#
#   GraphqlBody   — build { query, variables } for a point, binding the
#                   op's arguments to the document's declared variables.
#
#   GraphqlErrors — lift a GraphQL failure into an SDK error. GraphQL
#                   reports failures as a top-level `errors` array under
#                   HTTP 200, so the status-driven path in result_basic
#                   never sees them.

require_relative 'struct/voxgig_struct'

module ZefoyTiktokBotUtilities
  # Content type every GraphQL-over-HTTP request uses.
  GRAPHQL_CONTENT_TYPE = 'application/json'

  # Map a GraphQL error to the same error codes the HTTP path produces, so
  # a caller handles auth or rate limiting identically on both transports.
  # Servers put the machine-readable code in `extensions.code`;
  # Linear-style APIs use `extensions.type`.
  GraphqlErrorCode = ->(gqlerr) {
    ext = VoxgigStruct.getprop(gqlerr, 'extensions') || {}

    raw = VoxgigStruct.getprop(ext, 'code') ||
          VoxgigStruct.getprop(ext, 'type') || ''
    raw = raw.to_s.upcase

    if raw.include?('AUTH') || raw.include?('FORBIDDEN') ||
       raw.include?('UNAUTHENTICATED')
      next 'request_auth'
    end
    if raw.include?('RATELIMIT') || raw.include?('RATE_LIMIT') ||
       raw.include?('TOO_MANY')
      next 'request_ratelimit'
    end
    if raw.include?('BAD_USER_INPUT') || raw.include?('VALIDATION') ||
       raw.include?('INVALID')
      next 'request_invalid'
    end

    'request_graphql'
  }

  # Build the request body for a GraphQL point.
  #
  # Variables come from the op's own arguments: a named variable binds to
  # the like-named argument (`from`), and the input-object variable (empty
  # `from`) takes the request data as a whole — which is what makes a
  # generated create/update call look exactly like its REST equivalent.
  GraphqlBody = ->(ctx) {
    gql = VoxgigStruct.getprop(ctx.point, 'graphql')
    next nil unless gql.is_a?(Hash)

    # reqmatch/reqdata hold the caller's arguments for THIS call; data/match
    # hold the entity's current state. Which pair depends on whether the op
    # takes match or data input. A named variable falls back to the current
    # state, so updating a loaded entity with just {title} still binds the
    # stored id the mutation requires.
    datainput = ctx.op && 'data' == ctx.op.input
    reqsrc = datainput ? ctx.reqdata : ctx.reqmatch
    datasrc = datainput ? ctx.data : ctx.match
    reqsrc = {} unless reqsrc.is_a?(Hash)
    datasrc = {} unless datasrc.is_a?(Hash)

    variables = {}

    varlist = VoxgigStruct.getprop(gql, 'vars')
    varlist = [] unless varlist.is_a?(Array)

    varlist.each do |spec|
      next unless spec.is_a?(Hash)

      name = VoxgigStruct.getprop(spec, 'name')
      from = VoxgigStruct.getprop(spec, 'from')

      if from.nil? || '' == from
        # The input object IS the request body. Strip the action selector,
        # which is an SDK-side point discriminator, not an API field.
        body = {}
        reqsrc.each { |k, v| body[k] = v unless '$action' == k }
        variables[name] = body
        next
      end

      # Only send variables the caller actually supplied: sending an
      # explicit null would clear a field on many APIs.
      val = VoxgigStruct.getprop(reqsrc, from)
      val = VoxgigStruct.getprop(datasrc, from) if val.nil?
      variables[name] = val unless val.nil?
    end

    {
      'query' => VoxgigStruct.getprop(gql, 'doc'),
      'variables' => variables
    }
  }

  # Inspect a decoded GraphQL response body and record a failure when the
  # server reported one. Returns true when an error was recorded.
  #
  # Partial data (`data` alongside `errors`) is treated as failure: the
  # REST surface has no partial-success concept, and silently returning
  # half an object would be worse than failing. The raw envelope stays
  # available on the result for callers that need it.
  GraphqlErrors = ->(ctx) {
    result = ctx.result
    point = ctx.point

    next false if result.nil? || point.nil?
    next false unless 'graphql' == VoxgigStruct.getprop(point, 'kind')

    errors = VoxgigStruct.getprop(result.body, 'errors')
    next false unless errors.is_a?(Array) && !errors.empty?

    first = errors[0]
    msg = VoxgigStruct.getprop(first, 'message') || 'graphql error'
    msg = msg + ' (+' + (errors.length - 1).to_s + ' more)' if 1 < errors.length

    result.err = ctx.make_error(GraphqlErrorCode.call(first), 'graphql: ' + msg)
    result.ok = false

    true
  }
end
