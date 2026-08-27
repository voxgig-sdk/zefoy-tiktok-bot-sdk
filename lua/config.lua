-- ZefoyTiktokBot SDK configuration

-- Build a fresh, fully materialised config table. Every call rebuilds the
-- whole structure, so prefer require("config_shared") unless you need a
-- private copy you intend to mutate.
local function make_config()
  return {
    main = {
      name = "ZefoyTiktokBot",
      slug = "zefoy-tiktok-bot",
      version = "0.0.1",
      target = "lua",
    },
    feature = {
      ["test"] = {
        ["options"] = {
          ["active"] = false,
        },
        ["transport"] = "base",
      },
    },
    options = {
      base = "https://zefoy.com",
      auth = {
        prefix = "",
      },
      headers = {
        ["content-type"] = "application/json",
      },
      entity = {
        ["engagement"] = {},
      },
    },
    entity = {
      ["engagement"] = {
        ["fields"] = {
          {
            ["name"] = "amount",
            ["short"] = "The amount of engagement to acquire (if applicable)",
            ["type"] = "`$INTEGER`",
          },
          {
            ["name"] = "estimatedTime",
            ["short"] = "Estimated time to complete in seconds",
            ["type"] = "`$INTEGER`",
          },
          {
            ["name"] = "message",
            ["short"] = "Response message",
            ["type"] = "`$STRING`",
          },
          {
            ["name"] = "status",
            ["short"] = "Current status of the boost request",
            ["type"] = "`$STRING`",
          },
          {
            ["name"] = "success",
            ["short"] = "Indicates if the request was successful",
            ["type"] = "`$BOOLEAN`",
          },
          {
            ["name"] = "type",
            ["op"] = {
              ["create"] = {
                ["req"] = true,
                ["type"] = "`$STRING`",
              },
            },
            ["short"] = "The type of engagement boosted",
            ["type"] = "`$STRING`",
          },
          {
            ["name"] = "url",
            ["req"] = true,
            ["short"] = "The TikTok video or profile URL to boost",
            ["type"] = "`$STRING`",
          },
        },
        ["name"] = "engagement",
        ["op"] = {
          ["create"] = {
            ["input"] = "data",
            ["name"] = "create",
            ["points"] = {
              {
                ["args"] = {},
                ["kind"] = "http",
                ["method"] = "POST",
                ["orig"] = "/api/boost",
                ["parts"] = {
                  "api",
                  "boost",
                },
                ["select"] = {},
                ["transform"] = {
                  ["req"] = "`reqdata`",
                  ["res"] = "`body`",
                },
              },
            },
          },
        },
        ["relations"] = {
          ["ancestors"] = {},
        },
      },
    },
  }
end


local function make_feature(name)
  local features = require("features")
  local factory = features[name]
  if factory ~= nil then
    return factory()
  end
  return features.base()
end


-- Attach make_feature to the SDK class
local function setup_sdk(SDK)
  SDK._make_feature = make_feature
end


return make_config
