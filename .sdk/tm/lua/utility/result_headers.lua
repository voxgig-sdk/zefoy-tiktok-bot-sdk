-- ZefoyTiktokBot SDK utility: result_headers

local function result_headers_util(ctx)
  local response = ctx.response
  local result = ctx.result

  if result ~= nil then
    if response ~= nil and response.headers ~= nil then
      if type(response.headers) == "table" then
        result.headers = response.headers
      else
        result.headers = {}
      end
    else
      result.headers = {}
    end
  end

  return result
end

return result_headers_util
