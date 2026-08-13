# ZefoyTiktokBot SDK utility: make_response
module ZefoyTiktokBotUtilities
  MakeResponse = ->(ctx) {
    return ctx.out["response"], nil if ctx.out["response"]
    utility = ctx.utility
    spec = ctx.spec
    result = ctx.result
    response = ctx.response

    return nil, ctx.make_error("response_no_spec", "Expected context spec property to be defined.") unless spec
    return nil, ctx.make_error("response_no_response", "Expected context response property to be defined.") unless response
    return nil, ctx.make_error("response_no_result", "Expected context result property to be defined.") unless result

    spec.step = "response"
    utility.result_basic.call(ctx)
    utility.result_headers.call(ctx)
    utility.result_body.call(ctx)

    # GraphQL reports failures as a top-level `errors` array under HTTP
    # 200, so result_basic's status check never sees them. Lift them here,
    # before the response transform tries to unwrap data that is not there.
    utility.graphql_errors.call(ctx)

    utility.transform_response.call(ctx)

    result.ok = true if result.err.nil?
    ctx.ctrl.explain["result"] = result if ctx.ctrl.explain

    return response, nil
  }
end
