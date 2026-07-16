-- ZefoyTiktokBot SDK utility: make_options

local vs = require("utility.struct.struct")

local function make_options_util(ctx)
  local options = ctx.options or {}

  -- Merge custom utility overrides.
  local custom_utils = vs.getprop(options, "utility")
  if type(custom_utils) == "table" then
    local utility = ctx.utility
    if utility ~= nil then
      for key, val in pairs(custom_utils) do
        utility.custom[key] = val
      end
    end
  end

  local opts = vs.clone(options)
  if type(opts) ~= "table" then
    opts = {}
  end

  -- Feature add-order. options.feature may be given as an ordered LIST of
  -- { name = ..., active = ..., ... } entries (the list position IS the order
  -- in which features are added), or as a { name = {opts} } map. Normalize a
  -- list to a map (so merge/validate/init are unchanged) and remember the
  -- explicit order; a map defaults to test-first so the `test` mock transport
  -- is installed as the base of the transport wrapper chain.
  local featureorder = {}
  if vs.islist(opts.feature) then
    local fmap = {}
    for _, entry in ipairs(opts.feature) do
      if type(entry) == "table" and entry.name ~= nil then
        local name = entry.name
        local fopts = {}
        for k, v in pairs(entry) do
          if k ~= "name" then
            fopts[k] = v
          end
        end
        fmap[name] = fopts
        table.insert(featureorder, name)
      end
    end
    opts.feature = fmap
  end

  local config = ctx.config or {}
  local cfgopts = {}
  local co = config["options"]
  if type(co) == "table" then
    cfgopts = co
  end

  local optspec = {
    apikey = "",
    base = "http://localhost:8000",
    prefix = "",
    suffix = "",
    auth = {
      prefix = "",
    },
    headers = {
      ["`$CHILD`"] = "`$STRING`",
    },
    allow = {
      method = "GET,PUT,POST,PATCH,DELETE,OPTIONS",
      op = "create,update,load,list,remove,command,direct",
    },
    entity = {
      ["`$CHILD`"] = {
        ["`$OPEN`"] = true,
        active = false,
        alias = {},
      },
    },
    feature = {
      ["`$CHILD`"] = {
        ["`$OPEN`"] = true,
        active = false,
      },
    },
    utility = {},
    system = {},
    test = {
      active = false,
      entity = {
        ["`$OPEN`"] = true,
      },
    },
    clean = {
      keys = "key,token,id",
    },
  }

  -- Preserve system.fetch before merge/validate.
  local sys_fetch = vs.getpath(opts, "system.fetch")

  local merged = vs.merge({ {}, cfgopts, opts })
  local validated = vs.validate(merged, optspec)
  if type(validated) ~= "table" then
    validated = {}
  end
  opts = validated

  -- Restore system.fetch.
  if sys_fetch ~= nil then
    if type(opts["system"]) == "table" then
      opts["system"]["fetch"] = sys_fetch
    else
      opts["system"] = { fetch = sys_fetch }
    end
  end

  -- Derived clean config.
  local clean_keys = "key,token,id"
  local ck = vs.getpath(opts, "clean.keys")
  if type(ck) == "string" then
    clean_keys = ck
  end

  local parts = {}
  for part in string.gmatch(clean_keys, "[^,]+") do
    local trimmed = part:match("^%s*(.-)%s*$")
    if trimmed ~= "" then
      table.insert(parts, vs.escre(trimmed))
    end
  end
  local keyre = table.concat(parts, "|")

  -- Resolve the feature add-order: an explicit list order (above) wins;
  -- otherwise order the map test-first, then the remaining names sorted, so
  -- the outcome is deterministic and `test` is always the base transport.
  if #featureorder == 0 then
    local fmap = opts.feature
    local names = {}
    if type(fmap) == "table" then
      for k, _ in pairs(fmap) do
        if type(k) == "string" then
          table.insert(names, k)
        end
      end
    end
    table.sort(names)
    local has_test = false
    for _, n in ipairs(names) do
      if n == "test" then
        has_test = true
      end
    end
    if has_test then
      featureorder = { "test" }
      for _, n in ipairs(names) do
        if n ~= "test" then
          table.insert(featureorder, n)
        end
      end
    else
      featureorder = names
    end
  end

  local derived = { clean = {} }
  if keyre ~= "" then
    derived.clean = { keyre = keyre }
  end
  derived.featureorder = featureorder
  opts["__derived__"] = derived

  return opts
end

return make_options_util
