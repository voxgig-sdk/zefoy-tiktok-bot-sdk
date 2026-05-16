-- ZefoyTiktokBot SDK utility: result_basic

local function result_basic_util(ctx)
  local response = ctx.response
  local result = ctx.result

  if result ~= nil and response ~= nil then
    result.status = response.status
    result.status_text = response.status_text

    if result.status >= 400 then
      local msg = "request: " .. tostring(result.status) .. ": " .. result.status_text
      if result.err ~= nil then
        local prevmsg = ""
        if type(result.err) == "table" and result.err.msg then
          prevmsg = result.err.msg
        else
          prevmsg = tostring(result.err)
        end
        result.err = ctx:make_error("request_status", prevmsg .. ": " .. msg)
      else
        result.err = ctx:make_error("request_status", msg)
      end
    elseif response.err ~= nil then
      result.err = response.err
    end
  end

  return result
end

return result_basic_util
