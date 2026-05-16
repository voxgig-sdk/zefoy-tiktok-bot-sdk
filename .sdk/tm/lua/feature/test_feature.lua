-- ProjectName SDK test feature

local vs = require("utility.struct.struct")
local BaseFeature = require("feature.base_feature")

local TestFeature = {}
TestFeature.__index = TestFeature
setmetatable(TestFeature, { __index = BaseFeature })


function TestFeature.new()
  local self = setmetatable(BaseFeature.new(), TestFeature)
  self.version = "0.0.1"
  self.name = "test"
  self.active = true
  self.client = nil
  self.options = nil
  return self
end


function TestFeature:init(ctx, options)
  self.client = ctx.client
  self.options = options

  local entity = vs.getprop(options, "entity")
  if type(entity) ~= "table" then
    entity = {}
  end

  self.client.mode = "test"

  -- Ensure entity ids are correct.
  vs.walk(entity, function(key, val, parent, path)
    if #path == 2 and type(val) == "table" and key ~= nil then
      val["id"] = key
    end
    return val
  end)

  local test_self = self

  local function test_fetcher(fctx, _fullurl, _fetchdef)
    local function respond(status, data, extra)
      local out = {
        status = status,
        statusText = "OK",
        json = function() return data end,
        body = "not-used",
      }
      if type(extra) == "table" then
        for k, v in pairs(extra) do
          out[k] = v
        end
      end
      return out, nil
    end

    local op = fctx.op
    local entmap = vs.getprop(entity, op.entity)
    if type(entmap) ~= "table" then
      entmap = {}
    end

    -- For single-entity ops (load, remove) with an empty explicit match, fall
    -- back to the id the entity client already knows from a prior create/load
    -- (in fctx.match / fctx.data). Mirrors the TS mock where param() resolves
    -- the id from that accumulated state.
    local function resolve_match(explicit)
      if type(explicit) == "table" and next(explicit) ~= nil then
        return explicit
      end
      local function id_of(src)
        if src == nil then return nil end
        local v = vs.getprop(src, "id")
        if v ~= nil and v ~= "__UNDEFINED__" then return v end
        return nil
      end
      local v = id_of(fctx.match) or id_of(fctx.data)
      if v ~= nil then return { id = v } end
      return {}
    end

    if op.name == "load" then
      local args = test_self:build_args(fctx, op, resolve_match(fctx.reqmatch))
      local found = vs.select(entmap, args)
      local ent = vs.getelem(found, 0)
      if ent == nil then
        return respond(404, nil, { statusText = "Not found" })
      end
      vs.delprop(ent, "$KEY")
      local out = vs.clone(ent)
      return respond(200, out, nil)

    elseif op.name == "list" then
      local args = test_self:build_args(fctx, op, fctx.reqmatch)
      local found = vs.select(entmap, args)
      if found == nil then
        return respond(404, nil, { statusText = "Not found" })
      end
      if type(found) == "table" then
        for _, item in ipairs(found) do
          vs.delprop(item, "$KEY")
        end
      end
      local out = vs.clone(found)
      return respond(200, out, nil)

    elseif op.name == "update" then
      -- Match the existing entity by id only (or its alias). reqdata also
      -- contains the new field values, which would otherwise cause select
      -- to filter out the entity we want to update. Falls back to first
      -- entity when no match found, mirroring the TS mock.
      local update_match = {}
      if type(fctx.reqdata) == "table" then
        if fctx.reqdata["id"] ~= nil then update_match["id"] = fctx.reqdata["id"] end
        if op.alias_map ~= nil then
          local alias_id = vs.getprop(op.alias_map, "id")
          if alias_id ~= nil and fctx.reqdata[alias_id] ~= nil then
            update_match[alias_id] = fctx.reqdata[alias_id]
          end
        end
      end
      local args = test_self:build_args(fctx, op, update_match)
      local found = vs.select(entmap, args)
      local ent = vs.getelem(found, 0)
      if ent == nil and type(entmap) == "table" then
        for _, e in pairs(entmap) do
          if type(e) == "table" then ent = e; break end
        end
      end
      if ent == nil then
        return respond(404, nil, { statusText = "Not found" })
      end
      if type(ent) == "table" then
        local reqdata = fctx.reqdata
        if reqdata ~= nil then
          for k, v in pairs(reqdata) do
            ent[k] = v
          end
        end
      end
      vs.delprop(ent, "$KEY")
      local out = vs.clone(ent)
      return respond(200, out, nil)

    elseif op.name == "remove" then
      local args = test_self:build_args(fctx, op, resolve_match(fctx.reqmatch))
      local found = vs.select(entmap, args)
      local ent = vs.getelem(found, 0)
      -- Remove only the first matched entity. If nothing matches,
      -- succeed as a no-op rather than erroring.
      if type(ent) == "table" then
        local id = vs.getprop(ent, "id")
        vs.delprop(entmap, id)
      end
      return respond(200, nil, nil)

    elseif op.name == "create" then
      test_self:build_args(fctx, op, fctx.reqdata)
      local id = fctx.utility.param(fctx, "id")
      if id == nil then
        id = string.format("%04x%04x%04x%04x",
          math.random(0, 0xFFFF), math.random(0, 0xFFFF),
          math.random(0, 0xFFFF), math.random(0, 0xFFFF))
      end

      local ent = vs.clone(fctx.reqdata)
      if type(ent) == "table" then
        ent["id"] = id
        if type(id) == "string" then
          entmap[id] = ent
        end
        vs.delprop(ent, "$KEY")
        local out = vs.clone(ent)
        return respond(200, out, nil)
      end
      return respond(200, ent, nil)
    end

    return respond(404, nil, { statusText = "Unknown operation" })
  end

  ctx.utility.fetcher = test_fetcher
end


function TestFeature:build_args(ctx, op, args)
  local opname = op.name

  -- Get last point from config.
  local points = vs.getpath(ctx.config, "entity." .. ctx.entity:get_name() .. ".op." .. opname .. ".points")
  local point = vs.getelem(points, -1)

  -- Get required params.
  local params_path = vs.getpath(point, "args.params")
  local reqd_params = vs.select(params_path, { reqd = true })
  local reqd = vs.transform(reqd_params, { "`$EACH`", "", "`$KEY.name`" })

  local qand = {}
  local q = { ["`$AND`"] = qand }

  if args ~= nil then
    local keys = vs.keysof(args)
    if keys ~= nil then
      for _, key in ipairs(keys) do
        local is_id = (key == "id")
        local selected = vs.select(reqd, key)
        local is_reqd = not vs.isempty(selected)

        if is_id or is_reqd then
          local v = ctx.utility.param(ctx, key)
          local ka = nil
          if op.alias ~= nil then
            ka = vs.getprop(op.alias, key)
          end

          local qor = { { [key] = v } }
          if ka ~= nil and type(ka) == "string" then
            table.insert(qor, { [ka] = v })
          end

          table.insert(qand, { ["`$OR`"] = qor })
        end
      end
    end
  end

  q["`$AND`"] = qand

  if ctx.ctrl.explain ~= nil then
    ctx.ctrl.explain["test"] = { query = q }
  end

  return q
end


return TestFeature
