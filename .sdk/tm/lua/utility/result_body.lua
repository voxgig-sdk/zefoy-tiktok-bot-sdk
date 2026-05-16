-- ZefoyTiktokBot SDK utility: result_body

local function result_body_util(ctx)
  local response = ctx.response
  local result = ctx.result

  if result ~= nil then
    if response ~= nil and response.json_func ~= nil and response.body ~= nil then
      local json_data = response.json_func()
      result.body = json_data
    end
  end

  return result
end

return result_body_util
