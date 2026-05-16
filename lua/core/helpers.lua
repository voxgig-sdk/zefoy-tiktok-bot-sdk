-- ZefoyTiktokBot SDK helpers

local helpers = {}


function helpers.to_map(v)
  if type(v) == "table" then
    return v
  end
  return nil
end


function helpers.to_int(v)
  if type(v) == "number" then
    return math.floor(v)
  end
  return -1
end


function helpers.get_ctx_prop(m, key)
  if m == nil then
    return nil
  end
  return m[key]
end


return helpers
