-- Typed models for the ZefoyTiktokBot SDK (LuaLS annotations).
--
-- GENERATED from the API model: main.kit.entity.<e>.fields[] and per-op
-- params (op.<name>.points[].args.params[]). Field/param types come from the
-- canonical type sentinels via @voxgig/sdkgen canonToType (source of truth:
-- @voxgig/apidef VALID_CANON). Annotations only — no runtime effect. Do not
-- edit by hand.

---@class Engagement
---@field amount? number
---@field estimatedTime? number
---@field message? string
---@field status? string
---@field success? boolean
---@field type? string
---@field url string

---@class EngagementCreateData
---@field amount? number
---@field estimatedTime? number
---@field message? string
---@field status? string
---@field success? boolean
---@field type? string
---@field url string

local M = {}

return M
