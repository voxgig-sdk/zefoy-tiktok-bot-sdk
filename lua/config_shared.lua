-- ZefoyTiktokBot SDK shared configuration

local make_config = require("config")

local value = nil


-- Return the config for this Lua state, built once on first use. The SDK
-- reads the config on every request and never writes to it, so one instance
-- is shared by every client rather than rebuilt per client.
--
-- The returned table is shared: treat it as read-only. Callers that need to
-- mutate should use require("config")(), which always returns a fresh copy.
return function()
  if value == nil then
    value = make_config()
  end
  return value
end
