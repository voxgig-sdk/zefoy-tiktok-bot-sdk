-- ZefoyTiktokBot SDK utility: make_point

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

-- How many path segments a point has.
local function parts_len(point)
  local parts = vs.getprop(point, "parts")
  if type(parts) == "table" then
    return #parts
  end
  return 0
end


-- Does this point's path end in a parameter? A record route ends in the
-- record's identifier (/boards/{id}); a cross-reference that also returns
-- the entity ends in the relationship's name (/posts/{id}/author). That,
-- then fewest segments, is what tells the entity's own route from a
-- cross-reference. The same rule runs at generation time, in
-- helpers/opShape.ts — both sides must move together.
local function terminal_param(point)
  local parts = vs.getprop(point, "parts")
  if type(parts) ~= "table" or #parts == 0 then
    return false
  end
  local last = parts[#parts]
  return type(last) == "string" and last:sub(1, 1) == "{"
end


local function make_point_util(ctx)
  if ctx.out["point"] ~= nil then
    local preset = ctx.out["point"]
    -- PrePoint short-circuit: a feature (e.g. rbac) may place an SDK error
    -- in ctx.out["point"] to abort the operation before any endpoint
    -- resolution or network work happens.
    if type(preset) == "table" and preset.is_sdk_error == true then
      return nil, preset
    end
    ctx.point = preset
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
    local matched = false
    for i = 1, #op.points do
      local cand = op.points[i]
      local select_def = helpers.to_map(vs.getprop(cand, "select"))
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
        point = cand
        matched = true
        break
      end
    end

    -- select.exist can list more than the params needed to pick a point, so
    -- nothing matches — fall back to the entity's own route rather than
    -- whichever point came last.
    if not matched then
      -- A request naming an action reaches here only because that action's
      -- own point failed its exist test, so it is unbuildable whatever we
      -- pick. Refuse it BEFORE choosing a fallback: the guard below compares
      -- the chosen point's $action and would wave the request through
      -- whenever the fallback lands on the action point itself.
      local unmatched_action = nil
      if reqselector ~= nil then
        unmatched_action = vs.getprop(reqselector, "$action")
      end
      if unmatched_action ~= nil then
        return nil, ctx:make_error("point_action_invalid",
          'Operation "' .. op.name ..
          '" action "' .. vs.stringify(unmatched_action) .. '" is not valid.')
      end

      point = op.points[1]
      for i = 1, #op.points do
        local cand = op.points[i]
        local cand_term = terminal_param(cand)
        local best_term = terminal_param(point)
        if cand_term ~= best_term then
          if cand_term then
            point = cand
          end
        elseif parts_len(cand) < parts_len(point) then
          point = cand
        end
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
