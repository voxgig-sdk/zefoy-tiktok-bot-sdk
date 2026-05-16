-- ZefoyTiktokBot SDK utility: make_point

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

local function make_point_util(ctx)
  if ctx.out["point"] ~= nil then
    ctx.point = ctx.out["point"]
    return ctx.point, nil
  end

  local op = ctx.op
  local options = ctx.options

  local allow_op = vs.getpath(options, "allow.op") or ""
  if type(allow_op) == "string" and not string.find(allow_op, op.name, 1, true) then
    return nil, ctx:make_error("point_op_allow",
      'Operation "' .. op.name ..
      '" not allowed by SDK option allow.op value: "' .. allow_op .. '"')
  end

  if #op.points == 0 then
    return nil, ctx:make_error("point_no_points",
      'Operation "' .. op.name .. '" has no endpoint definitions.')
  end

  if #op.points == 1 then
    ctx.point = op.points[1]
  else
    local reqselector, selector
    if op.input == "data" then
      reqselector = ctx.reqdata
      selector = ctx.data
    else
      reqselector = ctx.reqmatch
      selector = ctx.match
    end

    local point = nil
    for i = 1, #op.points do
      point = op.points[i]
      local select_def = helpers.to_map(vs.getprop(point, "select"))
      local found = true

      if selector ~= nil and select_def ~= nil then
        local exist = vs.getprop(select_def, "exist")
        if type(exist) == "table" then
          for _, ek in ipairs(exist) do
            local existkey = tostring(ek)
            local rv = vs.getprop(reqselector, existkey)
            local sv = vs.getprop(selector, existkey)
            if rv == nil and sv == nil then
              found = false
              break
            end
          end
        end
      end

      if found then
        local req_action = vs.getprop(reqselector, "$action")
        local select_action = vs.getprop(select_def, "$action")
        if req_action ~= select_action then
          found = false
        end
      end

      if found then
        break
      end
    end

    if reqselector ~= nil then
      local req_action = vs.getprop(reqselector, "$action")
      if req_action ~= nil and point ~= nil then
        local point_select = helpers.to_map(vs.getprop(point, "select"))
        local point_action = vs.getprop(point_select, "$action")
        if req_action ~= point_action then
          return nil, ctx:make_error("point_action_invalid",
            'Operation "' .. op.name ..
            '" action "' .. vs.stringify(req_action) .. '" is not valid.')
        end
      end
    end

    ctx.point = point
  end

  return ctx.point, nil
end

return make_point_util
