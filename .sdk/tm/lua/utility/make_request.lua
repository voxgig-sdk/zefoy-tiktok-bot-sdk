-- ZefoyTiktokBot SDK utility: make_request

local Response = require("core.response")
local Result = require("core.result")

local function make_request_util(ctx)
  if ctx.out["request"] ~= nil then
    return ctx.out["request"], nil
  end

  local spec = ctx.spec
  local utility = ctx.utility

  local response = Response.new({})
  local result = Result.new({})
  ctx.result = result

  if spec == nil then
    return nil, ctx:make_error("request_no_spec",
      "Expected context spec property to be defined.")
  end

  local fetchdef, err = utility.make_fetch_def(ctx)
  if err ~= nil then
    response.err = err
    ctx.response = response
    spec.step = "postrequest"
    return response, nil
  end

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["fetchdef"] = fetchdef
  end

  spec.step = "prerequest"

  local url = fetchdef["url"] or ""
  local fetched, fetch_err = utility.fetcher(ctx, url, fetchdef)

  if fetch_err ~= nil then
    response.err = fetch_err
  elseif fetched == nil then
    response = Response.new({
      err = ctx:make_error("request_no_response", "response: undefined"),
    })
  elseif type(fetched) == "table" then
    response = Response.new(fetched)
  else
    response.err = ctx:make_error("request_invalid_response", "response: invalid type")
  end

  spec.step = "postrequest"
  ctx.response = response

  return response, nil
end

return make_request_util
