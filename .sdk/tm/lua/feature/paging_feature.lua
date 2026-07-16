-- ZefoyTiktokBot SDK paging feature
--
-- Pagination support for list operations. On the way out (PreRequest) it
-- stamps page/limit (or a cursor) into the request query; on the way back
-- (PreResult) it reads the server's pagination signals — a
-- `Link: <...>; rel="next"` header, `X-Page`/`X-Next-Page`/
-- `X-Total-Count` headers, or `next`/`cursor`/`nextCursor`/`hasMore`
-- fields in the body — and records them on `ctx.result.paging`. A
-- per-call `ctrl.paging` (cursor or page) wins over the option defaults,
-- so auto-iteration can advance the cursor/page and re-issue the list
-- call until `hasMore` is false. Parameter names (`pageParam`,
-- `limitParam`, `cursorParam`), `startPage` (default 1) and `limit` are
-- configurable.

local BaseFeature = require("feature.base_feature")

local PagingFeature = {}
PagingFeature.__index = PagingFeature
setmetatable(PagingFeature, { __index = BaseFeature })


-- Case-insensitive header lookup on a plain header table.
local function header_get(headers, name)
  if type(headers) ~= "table" then
    return nil
  end
  local lower = string.lower(name)
  for k, v in pairs(headers) do
    if type(k) == "string" and string.lower(k) == lower then
      return v
    end
  end
  return nil
end


function PagingFeature.new()
  local self = setmetatable(BaseFeature.new(), PagingFeature)
  self.version = "0.0.1"
  self.name = "paging"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function PagingFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options or {}

  if options["active"] == true then
    self.active = true
  else
    self.active = false
  end
end


function PagingFeature:PreRequest(ctx)
  if not self.active then
    return
  end
  if not self:_is_list(ctx) then
    return
  end
  local spec = ctx.spec
  if spec == nil then
    return
  end
  if spec.query == nil then
    spec.query = {}
  end

  local page_param = self.options["pageParam"] or "page"
  local limit_param = self.options["limitParam"] or "limit"
  local cursor_param = self.options["cursorParam"] or "cursor"

  -- A per-call cursor/page from ctrl takes priority (used by
  -- auto-iteration).
  local paging = {}
  if ctx.ctrl ~= nil and type(ctx.ctrl.paging) == "table" then
    paging = ctx.ctrl.paging
  end

  if paging["cursor"] ~= nil then
    spec.query[cursor_param] = paging["cursor"]
  elseif spec.query[page_param] == nil then
    if paging["page"] ~= nil then
      spec.query[page_param] = paging["page"]
    else
      spec.query[page_param] = self.options["startPage"] or 1
    end
  end

  if self.options["limit"] ~= nil and spec.query[limit_param] == nil then
    spec.query[limit_param] = self.options["limit"]
  end
end


function PagingFeature:PreResult(ctx)
  if not self.active then
    return
  end
  if not self:_is_list(ctx) then
    return
  end
  local result = ctx.result
  if result == nil then
    return
  end

  local headers = result.headers or {}
  local body = result.body

  local paging = {
    page = self:_num(header_get(headers, "x-page")),
    totalCount = self:_num(header_get(headers, "x-total-count")),
    nextPage = self:_num(header_get(headers, "x-next-page")),
    hasMore = false,
  }

  -- Link: <...>; rel="next"
  local link = header_get(headers, "link")
  if link ~= nil then
    local next_url = string.match(link,
      '<([^>]+)>%s*;%s*[Rr][Ee][Ll]="?[Nn][Ee][Xx][Tt]"?')
    if next_url ~= nil then
      paging.next = next_url
    end
  end

  -- Body-level cursors.
  if type(body) == "table" then
    if body["next"] ~= nil and paging.next == nil then
      paging.next = body["next"]
    end
    if body["cursor"] ~= nil then
      paging.cursor = body["cursor"]
    end
    if body["nextCursor"] ~= nil then
      paging.cursor = body["nextCursor"]
    end
    if type(body["hasMore"]) == "boolean" then
      paging.hasMore = body["hasMore"]
    end
  end

  paging.hasMore = paging.hasMore or
    paging.next ~= nil or paging.cursor ~= nil or paging.nextPage ~= nil

  result.paging = paging

  local client = self.client
  client._paging = { last = paging }
end


function PagingFeature:_is_list(ctx)
  local ops = self.options["ops"] or { "list" }
  local opname = ctx.op ~= nil and ctx.op.name or nil
  for _, o in ipairs(ops) do
    if o == opname then
      return true
    end
  end
  return false
end


function PagingFeature:_num(v)
  if v == nil then
    return nil
  end
  return tonumber(v)
end


return PagingFeature
