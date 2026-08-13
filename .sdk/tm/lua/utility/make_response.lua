-- ZefoyTiktokBot SDK utility: make_response

local function make_response_util(ctx)
  if ctx.out["response"] ~= nil then
    return ctx.out["response"], nil
  end

  local utility = ctx.utility
  local spec = ctx.spec
  local result = ctx.result
  local response = ctx.response

  if spec == nil then
    return nil, ctx:make_error("response_no_spec",
      "Expected context spec property to be defined.")
  end
  if response == nil then
    return nil, ctx:make_error("response_no_response",
      "Expected context response property to be defined.")
  end
  if result == nil then
    return nil, ctx:make_error("response_no_result",
      "Expected context result property to be defined.")
  end

  spec.step = "response"

  utility.result_basic(ctx)
  utility.result_headers(ctx)
  utility.result_body(ctx)

  -- GraphQL reports failures as a top-level `errors` array under HTTP 200,
  -- so result_basic's status check never sees them. Lift them here, before
  -- the response transform tries to unwrap data that is not there.
  utility.graphql_errors(ctx)

  utility.transform_response(ctx)

  if result.err == nil then
    result.ok = true
  end

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["result"] = result
  end

  return response, nil
end

return make_response_util
