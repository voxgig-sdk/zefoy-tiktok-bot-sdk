-- ZefoyTiktokBot SDK utility: make_error

local Operation = require("core.operation")
local Result = require("core.result")
local Control = require("core.control")
local ZefoyTiktokBotError = require("core.error")

local function make_error_util(ctx, err)
  if ctx == nil then
    local Context = require("core.context")
    ctx = Context.new({}, nil)
  end

  local op = ctx.op
  if op == nil then
    op = Operation.new({})
  end
  local opname = op.name
  if opname == "" or opname == "_" then
    opname = "unknown operation"
  end

  local result = ctx.result
  if result == nil then
    result = Result.new({})
  end
  result.ok = false

  if err == nil then
    err = result.err
  end
  if err == nil then
    err = ctx:make_error("unknown", "unknown error")
  end

  local errmsg = ""
  if type(err) == "table" and err.msg ~= nil then
    errmsg = err.msg
  elseif type(err) == "string" then
    errmsg = err
  else
    errmsg = tostring(err)
  end

  local msg = "ZefoyTiktokBotSDK: " .. opname .. ": " .. errmsg
  msg = ctx.utility.clean(ctx, msg)

  result.err = nil

  local spec = ctx.spec

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["err"] = { message = msg }
  end

  local sdk_err = ZefoyTiktokBotError.new("", msg, ctx)
  sdk_err.result = ctx.utility.clean(ctx, result)
  sdk_err.spec = ctx.utility.clean(ctx, spec)

  -- Promote the HTTP status to the top level, so a consumer can branch on
  -- `err.status` instead of reaching into `err.result`.
  sdk_err.status = result.status or -1

  if type(err) == "table" and getmetatable(err) == ZefoyTiktokBotError then
    sdk_err.code = err.code
  end

  ctx.ctrl.err = sdk_err

  -- Fire PreUnexpected so observability features (metrics, audit,
  -- telemetry, debug) record error paths that never reach PreDone (e.g. a
  -- PrePoint short-circuit). Fires after ctx.ctrl.err is set so hooks can
  -- read the error; features guard against double-recording when PreDone
  -- already fired.
  if ctx.utility ~= nil and type(ctx.utility.feature_hook) == "function" then
    ctx.utility.feature_hook(ctx, "PreUnexpected")
  end

  if ctx.ctrl.throw_err == false then
    return result.resdata, nil
  end

  return nil, sdk_err
end

return make_error_util
