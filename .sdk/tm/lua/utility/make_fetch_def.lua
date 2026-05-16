-- ZefoyTiktokBot SDK utility: make_fetch_def

local vs = require("utility.struct.struct")

local function make_fetch_def_util(ctx)
  local spec = ctx.spec
  if spec == nil then
    return nil, ctx:make_error("fetchdef_no_spec",
      "Expected context spec property to be defined.")
  end

  local Result = require("core.result")
  if ctx.result == nil then
    ctx.result = Result.new({})
  end

  spec.step = "prepare"

  local url, err = ctx.utility.make_url(ctx)
  if err ~= nil then
    return nil, err
  end

  spec.url = url

  local fetchdef = {
    url = url,
    method = spec.method,
    headers = spec.headers,
  }

  if spec.body ~= nil then
    if type(spec.body) == "table" then
      fetchdef["body"] = vs.jsonify(spec.body)
    else
      fetchdef["body"] = spec.body
    end
  end

  return fetchdef, nil
end

return make_fetch_def_util
