package = "voxgig-sdk-zefoy-tiktok-bot"
version = "0.0-1"
source = {
  url = "git://github.com/voxgig-sdk/zefoy-tiktok-bot-sdk.git"
}
description = {
  summary = "ZefoyTiktokBot SDK for Lua",
  license = "MIT"
}
dependencies = {
  "lua >= 5.3",
  "dkjson >= 2.5",
  "dkjson >= 2.5",
}
build = {
  type = "builtin",
  modules = {
    ["zefoy-tiktok-bot_sdk"] = "zefoy-tiktok-bot_sdk.lua",
    ["config"] = "config.lua",
    ["features"] = "features.lua",
  }
}
