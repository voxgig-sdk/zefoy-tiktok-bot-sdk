-- ZefoyTiktokBot SDK clienttrack feature
--
-- Client tracking. Establishes a stable per-client session id at
-- construction (PostConstruct) and stamps identifying headers on every
-- request (PreRequest): a `User-Agent` of `<clientName>/<clientVersion>`,
-- an `X-Client-Id` (the session), and a fresh per-request `X-Request-Id`.
-- This lets a server correlate all traffic from one SDK instance and each
-- individual call. Caller-provided User-Agent / X-Client-Id values are
-- never clobbered (matched case-insensitively). Header names, client
-- name/version and the id generator (`idgen`) are configurable; the
-- session id and request counter are exposed on `client._clienttrack`.

local BaseFeature = require("feature.base_feature")

local ClienttrackFeature = {}
ClienttrackFeature.__index = ClienttrackFeature
setmetatable(ClienttrackFeature, { __index = BaseFeature })


function ClienttrackFeature.new()
  local self = setmetatable(BaseFeature.new(), ClienttrackFeature)
  self.version = "0.0.1"
  self.name = "clienttrack"
  self.active = true
  self.client = nil
  self.options = nil
  self.session = ""
  self.requests = 0
  return self
end


function ClienttrackFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.requests = 0
end


function ClienttrackFeature:PostConstruct(ctx)
  if not self.active then
    return
  end
  self.session = self.options["sessionId"] or self:_genid("session")
  local client = self.client
  client._clienttrack = {
    session = self.session,
    requests = 0,
    clientName = self:_name(),
  }
end


function ClienttrackFeature:PreRequest(ctx)
  if not self.active then
    return
  end
  local spec = ctx.spec
  if spec == nil then
    return
  end
  if spec.headers == nil then
    spec.headers = {}
  end
  if self.session == "" then
    self.session = self.options["sessionId"] or self:_genid("session")
  end

  local h = self.options["headers"] or {}
  self.requests = self.requests + 1
  local request_id = self:_genid("request")

  self:_set(spec.headers, h["agent"] or "User-Agent", self:_name())
  self:_set(spec.headers, h["client"] or "X-Client-Id", self.session)
  spec.headers[h["request"] or "X-Request-Id"] = request_id

  local client = self.client
  if client._clienttrack == nil then
    client._clienttrack = {
      session = self.session,
      requests = 0,
      clientName = self:_name(),
    }
  end
  client._clienttrack.requests = self.requests
  client._clienttrack.lastRequestId = request_id
end


-- Do not clobber a caller-provided value (e.g. a custom User-Agent).
function ClienttrackFeature:_set(headers, name, value)
  local lower = string.lower(name)
  for k, _ in pairs(headers) do
    if type(k) == "string" and string.lower(k) == lower then
      return
    end
  end
  headers[name] = value
end


function ClienttrackFeature:_name()
  local name = self.options["clientName"] or "ZefoyTiktokBot-SDK"
  local version = self.options["clientVersion"] or "0.0.1"
  return name .. "/" .. version
end


function ClienttrackFeature:_genid(kind)
  local idgen = self.options["idgen"]
  if type(idgen) == "function" then
    return idgen(kind)
  end
  local id = kind:sub(1, 1) .. "-" .. string.format("%x%x%x",
    math.random(0, 9999999), math.random(0, 9999999), math.random(0, 9999999))
  return id:sub(1, 20)
end


return ClienttrackFeature
