-- ZefoyTiktokBot SDK idempotency feature
--
-- Idempotency keys for mutating operations. Adds an `Idempotency-Key`
-- header (name configurable via `header`) to unsafe requests so a server
-- can de-duplicate retried writes. The key is set once, at PreRequest,
-- before the request is built — so it is stable across transport-level
-- retries of the same call. A caller-supplied header is never overwritten
-- (matched case-insensitively). The key generator is injectable
-- (`keygen`) for deterministic tests.

local BaseFeature = require("feature.base_feature")

local IdempotencyFeature = {}
IdempotencyFeature.__index = IdempotencyFeature
setmetatable(IdempotencyFeature, { __index = BaseFeature })


function IdempotencyFeature.new()
  local self = setmetatable(BaseFeature.new(), IdempotencyFeature)
  self.version = "0.0.1"
  self.name = "idempotency"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function IdempotencyFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end
end


function IdempotencyFeature:PreRequest(ctx)
  if not self.active then
    return
  end

  local spec = ctx.spec
  if spec == nil then
    return
  end

  if not self:_mutating(ctx) then
    return
  end

  local header = self.options["header"] or "Idempotency-Key"
  if spec.headers == nil then
    spec.headers = {}
  end

  -- Respect a key the caller already provided.
  if self:_existing(spec.headers, header) ~= nil then
    return
  end

  local key = self:_genkey()
  spec.headers[header] = key

  local client = self.client
  if client._idempotency == nil then
    client._idempotency = { issued = 0, last = nil }
  end
  client._idempotency.issued = client._idempotency.issued + 1
  client._idempotency.last = key
end


function IdempotencyFeature:_mutating(ctx)
  local methods = self.options["methods"] or { "POST", "PUT", "PATCH", "DELETE" }
  local method = ""
  if ctx.spec ~= nil and type(ctx.spec.method) == "string" then
    method = string.upper(ctx.spec.method)
  end
  if method ~= "" then
    for _, m in ipairs(methods) do
      if m == method then
        return true
      end
    end
  end
  local opname = ctx.op ~= nil and ctx.op.name or nil
  local ops = self.options["ops"] or { "create", "update", "remove" }
  for _, o in ipairs(ops) do
    if o == opname then
      return true
    end
  end
  return false
end


function IdempotencyFeature:_existing(headers, header)
  local lower = string.lower(header)
  for k, v in pairs(headers) do
    if type(k) == "string" and string.lower(k) == lower then
      return v
    end
  end
  return nil
end


function IdempotencyFeature:_genkey()
  local keygen = self.options["keygen"]
  if type(keygen) == "function" then
    return keygen()
  end
  local key = string.format("%x%x%x%x",
    math.random(0, 9999999), math.random(0, 9999999),
    math.random(0, 9999999), math.random(0, 9999999))
  if #key < 24 then
    key = key .. string.rep("0", 24 - #key)
  end
  return key:sub(1, 24)
end


return IdempotencyFeature
