-- ZefoyTiktokBot SDK Engagement entity

local vs = require("utility.struct.struct")
local helpers = require("core.helpers")

local EngagementEntity = {}
EngagementEntity.__index = EngagementEntity


function EngagementEntity.new(client, entopts)
  entopts = entopts or {}
  if entopts["active"] == nil then
    entopts["active"] = true
  elseif entopts["active"] == false then
    -- keep false
  else
    entopts["active"] = true
  end

  local self = setmetatable({}, EngagementEntity)
  self._name = "engagement"
  self._client = client
  self._utility = client:get_utility()
  self._entopts = entopts
  self._data = {}
  self._deleted = false
  self._match = {}

  self._entctx = self._utility.make_context({
    entity = self,
    entopts = entopts,
  }, client:get_root_ctx())

  self._utility.feature_hook(self._entctx, "PostConstructEntity")

  return self
end


function EngagementEntity:get_name()
  return self._name
end


function EngagementEntity:make()
  local opts = {}
  for k, v in pairs(self._entopts) do
    opts[k] = v
  end
  return EngagementEntity.new(self._client, opts)
end


-- Every operation resolves to the entity; `remove` additionally marks
-- it. The instance KEEPS the data it held — a caller can still read what
-- was deleted — but it is no longer a live record. See AGENTS.md.
function EngagementEntity:mark_deleted()
  self._deleted = true
end


function EngagementEntity:deleted()
  return true == self._deleted
end


function EngagementEntity:data_set(args)
  if args ~= nil then
    self._data = helpers.to_map(vs.clone(args)) or {}
    self._utility.feature_hook(self._entctx, "SetData")
  end
end


function EngagementEntity:data_get()
  self._utility.feature_hook(self._entctx, "GetData")
  return vs.clone(self._data)
end


function EngagementEntity:match_set(args)
  if args ~= nil then
    self._match = helpers.to_map(vs.clone(args)) or {}
    self._utility.feature_hook(self._entctx, "SetMatch")
  end
end


function EngagementEntity:match_get()
  self._utility.feature_hook(self._entctx, "GetMatch")
  return vs.clone(self._match)
end


-- Feature #4: run `action` through the full pipeline and return a stateful
-- iterator over result items, so the `streaming` feature's incremental output
-- is reachable from a generated entity (a normal op call materialises the
-- whole result). Use it as `for item in ent:stream("list") do ... end`.
-- `callopts` parameterises the call:
--   - inbound (download): iterate items/chunks (from the streaming feature
--     when active, else the materialised items);
--   - outbound (upload): an iterable `body` in callopts is attached to the
--     request so the transport can stream the payload;
--   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.
function EngagementEntity:stream(action, args, callopts)
  local utility = self._utility
  callopts = callopts or {}
  local signal = callopts["signal"]

  local ctrl = {}
  if type(callopts["ctrl"]) == "table" then
    for k, v in pairs(callopts["ctrl"]) do
      ctrl[k] = v
    end
  end
  ctrl["stream"] = callopts

  local ctxmap = {
    opname = action,
    ctrl = ctrl,
    match = self._match,
    data = self._data,
  }
  if type(args) == "table" then
    for k, v in pairs(args) do
      ctxmap[k] = v
    end
  end

  local ctx = utility.make_context(ctxmap, self._entctx)

  -- Outbound: expose the caller's iterable payload so the request builder /
  -- transport can stream it as the request body.
  local body = callopts["body"]
  if body ~= nil then
    ctx.reqdata = ctx.reqdata or {}
    ctx.reqdata["body$"] = body
    ctx.meta["stream_out"] = body
  end

  local function aborted()
    if signal == nil then
      return false
    end
    if type(signal) == "function" then
      return signal() and true or false
    end
    if type(signal) == "table" and signal.aborted ~= nil then
      return signal.aborted and true or false
    end
    return false
  end

  return coroutine.wrap(function()
    utility.feature_hook(ctx, "PrePoint")
    local point, err = utility.make_point(ctx)
    ctx.out["point"] = point
    if err ~= nil then
      return
    end

    utility.feature_hook(ctx, "PreSpec")
    local spec
    spec, err = utility.make_spec(ctx)
    ctx.out["spec"] = spec
    if err ~= nil then
      return
    end

    utility.feature_hook(ctx, "PreRequest")
    local resp
    resp, err = utility.make_request(ctx)
    ctx.out["request"] = resp
    if err ~= nil then
      return
    end

    utility.feature_hook(ctx, "PreResponse")
    local resp2
    resp2, err = utility.make_response(ctx)
    ctx.out["response"] = resp2
    if err ~= nil then
      return
    end

    utility.feature_hook(ctx, "PreResult")
    local result
    result, err = utility.make_result(ctx)
    ctx.out["result"] = result
    if err ~= nil then
      return
    end

    utility.feature_hook(ctx, "PreDone")

    result = ctx.result

    -- Inbound: prefer the streaming feature's incremental iterator; else fall
    -- back to the materialised items so stream always yields.
    local stream_fn = nil
    if result ~= nil then
      stream_fn = result.stream
    end
    if type(stream_fn) == "function" then
      for item in stream_fn() do
        if aborted() then
          return
        end
        coroutine.yield(item)
      end
    else
      local data = utility.done(ctx)
      local items
      if vs.islist(data) then
        items = data
      elseif data == nil then
        items = {}
      else
        items = { data }
      end
      for _, item in ipairs(items) do
        if aborted() then
          return
        end
        coroutine.yield(item)
      end
    end
  end)
end







---@param reqdata EngagementCreateData
---@param ctrl? table
---@return Engagement
---@return string? err
function EngagementEntity:create(reqdata, ctrl)
  local utility = self._utility
  local ctx = utility.make_context({
    opname = "create",
    ctrl = ctrl,
    match = self._match,
    data = self._data,
    reqdata = reqdata,
  }, self._entctx)

  return self:_run_op(ctx, function()
    if ctx.result ~= nil then
      if ctx.result.resdata ~= nil then
        self._data = helpers.to_map(vs.clone(ctx.result.resdata)) or {}
      end
    end
  end)
end








function EngagementEntity:_run_op(ctx, post_done)
  local utility = self._utility

  utility.feature_hook(ctx, "PrePoint")

  local point, err = utility.make_point(ctx)
  ctx.out["point"] = point
  if err ~= nil then
    return utility.make_error(ctx, err)
  end

  utility.feature_hook(ctx, "PreSpec")

  local spec
  spec, err = utility.make_spec(ctx)
  ctx.out["spec"] = spec
  if err ~= nil then
    return utility.make_error(ctx, err)
  end

  utility.feature_hook(ctx, "PreRequest")

  local resp
  resp, err = utility.make_request(ctx)
  ctx.out["request"] = resp
  if err ~= nil then
    return utility.make_error(ctx, err)
  end

  utility.feature_hook(ctx, "PreResponse")

  local resp2
  resp2, err = utility.make_response(ctx)
  ctx.out["response"] = resp2
  if err ~= nil then
    return utility.make_error(ctx, err)
  end

  utility.feature_hook(ctx, "PreResult")

  local result
  result, err = utility.make_result(ctx)
  ctx.out["result"] = result
  if err ~= nil then
    return utility.make_error(ctx, err)
  end

  utility.feature_hook(ctx, "PreDone")

  post_done()

  local out, done_err = utility.done(ctx)
  if done_err ~= nil then
    return out, done_err
  end

  -- An operation resolves to the ENTITY, not the raw data. Entities are
  -- stateful: post_done has just absorbed resdata/resmatch into this
  -- instance, and the caller reaches the record through data(). Two
  -- structural exceptions: `list` resolves to the ARRAY of entity
  -- instances make_result built, and a failed op with throwing disabled
  -- hands back the error payload unchanged. `remove` additionally marks
  -- the entity deleted; it KEEPS its data, so a caller can still read
  -- what was removed. See AGENTS.md "Entity operations return ENTITIES".
  local opname = ctx.op ~= nil and ctx.op.name or nil

  if ctx.result ~= nil and ctx.result.ok and opname ~= "list" then
    if opname == "remove" then
      self:mark_deleted()
    end
    return self, nil
  end

  return out, nil
end


return EngagementEntity
