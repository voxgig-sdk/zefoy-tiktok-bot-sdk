-- ZefoyTiktokBot SDK utility: make_options

local vs = require("utility.struct.struct")

local function make_options_util(ctx)
  local options = ctx.options or {}

  -- Merge utility overrides from options onto the utility object.
  --
  -- A key naming a real utility member REPLACES it; anything else is attached
  -- as a custom extra. Shelving everything in `custom` - a table nothing reads
  -- - made `utility = { fetcher = ... }`, the documented transport seam, a
  -- silent no-op here while ts honoured it.
  --
  -- Option keys are camelCase, as ts spells them; members here are
  -- snake_case. Only a PUBLIC name may replace: public utility names carry no
  -- underscore, so an underscore means the caller named something of their
  -- own - possibly the internal spelling of a real member. `make_error` must
  -- stay an extension, or a non-callable would break the error path on the
  -- next request.
  local custom_utils = vs.getprop(options, "utility")
  if type(custom_utils) == "table" then
    local utility = ctx.utility
    if utility ~= nil then
      for key, val in pairs(custom_utils) do
        local member = nil
        if type(key) == "string" and not key:find("_") then
          member = key:gsub("(%u)", function(c) return "_" .. c:lower() end)
        end
        if member ~= nil and member ~= "custom" and utility[member] ~= nil then
          utility[member] = val
        else
          utility.custom[key] = val
        end
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
      op = "create,update,load,list,remove,command,direct,graphql",
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
    -- Feature INSTANCES supplied at construction (the station adopt
    -- path): consumed by the constructor's feature_add loop, so they are
    -- class instances, not data -- `$ANY` accepts them verbatim. Without
    -- this entry the seam is dead: the constructor reads
    -- options.extend, but validate rejected the key.
    extend = "`$ANY`",
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
    -- Server-variable values for a templated base URL (OpenAPI server
    -- variables): {name} placeholders in `base` are substituted from this
    -- map at construction. Spec defaults arrive via the generated config;
    -- user values override them.
    server = {
      ["`$CHILD`"] = "",
    },
  }

  -- Preserve system.fetch before merge/validate.
  local sys_fetch = vs.getpath(opts, "system.fetch")

  -- Preserve extend feature INSTANCES before merge/validate, by ORIGINAL
  -- reference (the ts makeOptions keeps the caller's instances too):
  -- merge/validate are data-oriented and would mangle instance tables
  -- carrying functions -- the same reason system.fetch is preserved.
  local extend = nil
  if type(options) == "table" and type(options["extend"]) == "table" then
    extend = options["extend"]
  end

  -- Clone the config side before merging: `config` is a per-Lua-state
  -- singleton (see config_shared), and merge would otherwise use its nested
  -- tables as merge TARGETS — one instance's options (server, headers, ...)
  -- would contaminate every instance constructed after it.
  local merged = vs.merge({ {}, vs.clone(cfgopts), opts })
  local validated = vs.validate(merged, optspec)
  if type(validated) ~= "table" then
    validated = {}
  end
  opts = validated

  -- Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
  -- Every placeholder must resolve to a non-empty value: from
  -- options.server (user), else the config default. A placeholder that
  -- resolves to "" is a construction ERROR in live mode — the URL cannot
  -- work — but in test mode substitutes the deterministic value
  -- "test-<name>" so offline tests need no configuration.
  local base = opts.base
  if type(base) == "string" and string.find(base, "{", 1, true) then
    local testmode = vs.getpath(opts, "test.active") == true
      or vs.getpath(opts, "feature.test.active") == true
    local server = type(opts.server) == "table" and opts.server or {}
    local sdkname = vs.getpath(config, "main.name")
    if type(sdkname) ~= "string" or sdkname == "" then
      sdkname = "SDK"
    end
    opts.base = string.gsub(base, "{([%w_]+)}", function(name)
      local val = server[name]
      if type(val) ~= "string" then
        val = ""
      end
      if val == "" then
        if testmode then
          return "test-" .. name
        end
        error(sdkname .. ": the server variable '" .. name .. "' is required: " ..
          "the API base URL is '" .. base .. "' — pass " ..
          "{ server = { " .. name .. " = \"...\" } } in the SDK options", 0)
      end
      return val
    end)
  end

  -- Restore system.fetch.
  if sys_fetch ~= nil then
    if type(opts["system"]) == "table" then
      opts["system"]["fetch"] = sys_fetch
    else
      opts["system"] = { fetch = sys_fetch }
    end
  end

  -- Restore extend feature instances.
  if extend ~= nil then
    opts["extend"] = extend
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
    -- Station special case, mirroring test's: its transport wrap must
    -- sit immediately outside the base transport (inside retry/cache/
    -- netsim), so map-form activation hoists it to just after test -
    -- or first, when no test entry exists. Without this the sorted
    -- default would init station last and wrap OUTSIDE the recording
    -- features, turning its wire-truth events into fiction.
    local si = nil
    for i, n in ipairs(featureorder) do
      if n == "station" then
        si = i
        break
      end
    end
    if si ~= nil then
      table.remove(featureorder, si)
      local ti = 0
      for i, n in ipairs(featureorder) do
        if n == "test" then
          ti = i
          break
        end
      end
      table.insert(featureorder, ti + 1, "station")
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
