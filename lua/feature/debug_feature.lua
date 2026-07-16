-- ZefoyTiktokBot SDK debug feature
--
-- Request/response capture for debugging. Records a bounded ring buffer
-- of per-operation traces — op, method, URL, redacted headers, response
-- status and timing — on `client._debug.entries`. Sensitive header values
-- (names matching `redact`, default authorization/cookie/api-key style
-- names) are masked as `<redacted>`. An optional `on_entry` callback
-- (camelCase `onEntry` also accepted, matching the other targets)
-- receives each finished entry. `max` caps the buffer (default 100). The
-- clock is injectable (`now`) for deterministic tests.

local BaseFeature = require("feature.base_feature")

local DebugFeature = {}
DebugFeature.__index = DebugFeature
setmetatable(DebugFeature, { __index = BaseFeature })


local REDACT = {
  "authorization", "cookie", "set-cookie", "api-key", "apikey",
  "x-api-key", "idempotency-key",
}


function DebugFeature.new()
  local self = setmetatable(BaseFeature.new(), DebugFeature)
  self.version = "0.0.1"
  self.name = "debug"
  self.active = true
  self.client = nil
  self.options = nil
  -- Weak keys: an abandoned context must not leak its open entry.
  self.entries = setmetatable({}, { __mode = "k" })
  return self
end


function DebugFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end

  self.entries = setmetatable({}, { __mode = "k" })

  if not self.active then
    return
  end

  local client = self.client
  if client._debug == nil then
    client._debug = { entries = {} }
  end
end


function DebugFeature:PreRequest(ctx)
  if not self.active then
    return
  end
  local spec = ctx.spec
  local url = nil
  local method = nil
  local headers = nil
  if spec ~= nil then
    method = spec.method
    url = (spec.url ~= nil and spec.url ~= "") and spec.url or spec.path
    headers = spec.headers
  end
  local entry = {
    op = ((ctx.op ~= nil and ctx.op.entity) or "_") .. "." ..
      ((ctx.op ~= nil and ctx.op.name) or "_"),
    method = method,
    url = url,
    headers = self:_redact(headers),
    start = self:_now(),
  }
  self.entries[ctx] = entry
end


function DebugFeature:PreResponse(ctx)
  if not self.active then
    return
  end
  local entry = self.entries[ctx]
  if entry == nil then
    return
  end
  local response = ctx.response
  if response ~= nil then
    entry.status = response.status
    if entry.url == nil or entry.url == "" then
      if ctx.spec ~= nil then
        entry.url = ctx.spec.url
      end
    end
  end
end


function DebugFeature:PreDone(ctx)
  if not self.active then
    return
  end
  self:_finish(ctx, true)
end


function DebugFeature:PreUnexpected(ctx)
  if not self.active then
    return
  end
  local entry = self.entries[ctx]
  if entry ~= nil and ctx.ctrl ~= nil and ctx.ctrl.err ~= nil then
    local e = ctx.ctrl.err
    if type(e) == "table" and e.msg ~= nil then
      entry.error = e.msg
    else
      entry.error = tostring(e)
    end
  end
  self:_finish(ctx, false)
end


function DebugFeature:_finish(ctx, ok)
  local entry = self.entries[ctx]
  if entry == nil then
    return
  end
  self.entries[ctx] = nil
  entry.ok = ok and (ctx.result == nil or ctx.result.ok ~= false)
  entry.durationMs = math.max(0, self:_now() - entry.start)
  if entry.status == nil and ctx.result ~= nil then
    entry.status = ctx.result.status
  end

  local client = self.client
  local buf = client._debug.entries
  table.insert(buf, entry)
  local max = self.options["max"] == nil and 100 or self.options["max"]
  while #buf > max do
    table.remove(buf, 1)
  end

  local on_entry = self.options["on_entry"] or self.options["onEntry"]
  if type(on_entry) == "function" then
    pcall(on_entry, entry)
  end
end


function DebugFeature:_redact(headers)
  if headers == nil then
    return {}
  end
  local patterns = self.options["redact"] or REDACT
  local out = {}
  for k, v in pairs(headers) do
    local masked = false
    if type(k) == "string" then
      local lower = string.lower(k)
      for _, p in ipairs(patterns) do
        if p == lower then
          masked = true
          break
        end
      end
    end
    if masked then
      out[k] = "<redacted>"
    else
      out[k] = v
    end
  end
  return out
end


function DebugFeature:_now()
  local now = self.options["now"]
  if type(now) == "function" then
    return now()
  end
  return os.time() * 1000
end


return DebugFeature
