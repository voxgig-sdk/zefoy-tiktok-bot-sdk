-- ZefoyTiktokBot SDK utility: make_url

local vs = require("utility.struct.struct")

local function make_url_util(ctx)
  local spec = ctx.spec
  local result = ctx.result

  if spec == nil then
    return "", ctx:make_error("url_no_spec",
      "Expected context spec property to be defined.")
  end
  if result == nil then
    return "", ctx:make_error("url_no_result",
      "Expected context result property to be defined.")
  end

  local url = vs.join({ spec.base, spec.prefix, spec.path, spec.suffix }, "/", true)
  local resmatch = {}

  local param_items = vs.items(spec.params)
  if param_items ~= nil then
    for _, item in ipairs(param_items) do
      local key = item[1]
      local val = item[2]
      if val ~= nil and type(key) == "string" then
        local placeholder = "{" .. key .. "}"
        local val_str = type(val) == "string" and val or tostring(val)
        local encoded = vs.escurl(val_str)
        -- Plain string replacement (not pattern-based)
        local i, j = url:find(placeholder, 1, true)
        while i do
          url = url:sub(1, i - 1) .. encoded .. url:sub(j + 1)
          i, j = url:find(placeholder, i + #encoded, true)
        end
        resmatch[key] = val
      end
    end
  end

  -- Append query string from spec.query.
  local qsep = "?"
  local query_items = vs.items(spec.query)
  if query_items ~= nil then
    for _, item in ipairs(query_items) do
      local key = item[1]
      local val = item[2]
      if val ~= nil and type(key) == "string" then
        local val_str = type(val) == "string" and val or tostring(val)
        url = url .. qsep .. vs.escurl(key) .. "=" .. vs.escurl(val_str)
        qsep = "&"
        resmatch[key] = val
      end
    end
  end

  result.resmatch = resmatch

  return url, nil
end

return make_url_util
