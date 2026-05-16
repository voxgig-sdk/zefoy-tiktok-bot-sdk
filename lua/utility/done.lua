-- ZefoyTiktokBot SDK utility: done

local function done_util(ctx)
  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain = ctx.utility.clean(ctx, ctx.ctrl.explain)
    local explain_result = ctx.ctrl.explain["result"]
    if type(explain_result) == "table" then
      explain_result["err"] = nil
    end
  end

  if ctx.result ~= nil and ctx.result.ok then
    return ctx.result.resdata, nil
  end

  return ctx.utility.make_error(ctx, nil)
end

return done_util
