-- ZefoyTiktokBot SDK utility: prepare_body

local function prepare_body_util(ctx)
  local op = ctx.op

  if op.input == "data" then
    local body = ctx.utility.transform_request(ctx)
    return body
  end

  return nil
end

return prepare_body_util
