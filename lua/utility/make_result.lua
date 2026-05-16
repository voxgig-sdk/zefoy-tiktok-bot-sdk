-- ZefoyTiktokBot SDK utility: make_result

local function make_result_util(ctx)
  if ctx.out["result"] ~= nil then
    return ctx.out["result"], nil
  end

  local utility = ctx.utility
  local op = ctx.op
  local entity = ctx.entity
  local spec = ctx.spec
  local result = ctx.result

  if spec == nil then
    return nil, ctx:make_error("result_no_spec",
      "Expected context spec property to be defined.")
  end
  if result == nil then
    return nil, ctx:make_error("result_no_result",
      "Expected context result property to be defined.")
  end

  spec.step = "result"

  utility.transform_response(ctx)

  if op.name == "list" then
    local resdata = result.resdata
    result.resdata = {}

    if resdata ~= nil and type(resdata) == "table" and entity ~= nil then
      local entities = {}
      for _, entry in ipairs(resdata) do
        local ent = entity:make()
        if type(entry) == "table" then
          ent:data_set(entry)
        end
        table.insert(entities, ent)
      end
      result.resdata = entities
    end
  end

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["result"] = result
  end

  return result, nil
end

return make_result_util
