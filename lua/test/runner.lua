-- ZefoyTiktokBot SDK test runner

local json = require("dkjson")
local vs = require("utility.struct.struct")

local runner = {}


function runner.load_env_local()
  local f = io.open("../../.env.local", "r")
  if f == nil then
    return
  end
  local content = f:read("*a")
  f:close()
  for raw_line in content:gmatch("[^\r\n]+") do
    local line = raw_line:match("^%s*(.-)%s*$")
    if line ~= "" and not line:match("^#") then
      local key, val = line:match("^([^=]+)=(.*)$")
      if key and val then
        key = key:match("^%s*(.-)%s*$")
        val = val:match("^%s*(.-)%s*$")
        -- Set as env variable (platform-dependent, stored in table)
        runner._env[key] = val
      end
    end
  end
end

runner._env = {}

function runner.getenv(key)
  return runner._env[key] or os.getenv(key)
end


function runner.env_override(m)
  local live = runner.getenv("ZEFOY_TIKTOK_BOT_TEST_LIVE")
  local override = runner.getenv("ZEFOY_TIKTOK_BOT_TEST_OVERRIDE")

  if live == "TRUE" or override == "TRUE" then
    for key, _ in pairs(m) do
      local envval = runner.getenv(key)
      if envval ~= nil and envval ~= "" then
        envval = envval:match("^%s*(.-)%s*$")
        if envval:sub(1, 1) == "{" then
          local parsed = json.decode(envval)
          if parsed ~= nil then
            m[key] = parsed
            goto continue
          end
        end
        m[key] = envval
        ::continue::
      end
    end
  end

  local explain = runner.getenv("ZEFOY_TIKTOK_BOT_TEST_EXPLAIN")
  if explain ~= nil and explain ~= "" then
    m["ZEFOY_TIKTOK_BOT_TEST_EXPLAIN"] = explain
  end

  return m
end


function runner.entity_list_to_data(list)
  local out = {}
  for _, item in ipairs(list) do
    if type(item) == "table" then
      if type(item.data_get) == "function" then
        local d = item:data_get()
        if type(d) == "table" then
          table.insert(out, d)
        end
      else
        table.insert(out, item)
      end
    end
  end
  return out
end


-- Load sdk-test-control.json from this test dir; cache. Returns an
-- empty-skip default if the file is missing or invalid.
runner._test_control = nil

function runner.load_test_control()
  if runner._test_control ~= nil then
    return runner._test_control
  end
  local this_dir = debug.getinfo(1, "S").source:match("^@(.+/)") or "./"
  local ctrl_path = this_dir .. "sdk-test-control.json"
  local f = io.open(ctrl_path, "r")
  if f == nil then
    runner._test_control = {
      version = 1,
      test = {
        skip = {
          live = { direct = {}, entityOp = {} },
          unit = { direct = {}, entityOp = {} },
        },
      },
    }
    return runner._test_control
  end
  local content = f:read("*a")
  f:close()
  local parsed = json.decode(content)
  if parsed == nil then
    runner._test_control = {
      version = 1,
      test = {
        skip = {
          live = { direct = {}, entityOp = {} },
          unit = { direct = {}, entityOp = {} },
        },
      },
    }
  else
    runner._test_control = parsed
  end
  return runner._test_control
end


-- Check sdk-test-control.json for a skip entry. Returns (skip, reason).
function runner.is_control_skipped(kind, name, mode)
  local ctrl = runner.load_test_control()
  local skip = (((ctrl.test or {}).skip or {})[mode] or {})
  local items = skip[kind] or {}
  for _, item in ipairs(items) do
    if kind == "direct" and item.test == name then
      return true, item.reason
    end
    if kind == "entityOp" then
      local key = (item.entity or "") .. "." .. (item.op or "")
      if key == name then
        return true, item.reason
      end
    end
  end
  return false, nil
end


-- Per-test live pacing delay (ms); default 500.
function runner.live_delay_ms()
  local ctrl = runner.load_test_control()
  local v = ((ctrl.test or {}).live or {}).delayMs
  if type(v) == "number" and v >= 0 then
    return v
  end
  return 500
end


return runner
