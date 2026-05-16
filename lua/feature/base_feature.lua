-- ZefoyTiktokBot SDK base feature

local BaseFeature = {}
BaseFeature.__index = BaseFeature


function BaseFeature.new()
  local self = setmetatable({}, BaseFeature)
  self.version = "0.0.1"
  self.name = "base"
  self.active = true
  return self
end

function BaseFeature:get_version() return self.version end
function BaseFeature:get_name() return self.name end
function BaseFeature:get_active() return self.active end

function BaseFeature:init(ctx, options) end
function BaseFeature:PostConstruct(ctx) end
function BaseFeature:PostConstructEntity(ctx) end
function BaseFeature:SetData(ctx) end
function BaseFeature:GetData(ctx) end
function BaseFeature:GetMatch(ctx) end
function BaseFeature:SetMatch(ctx) end
function BaseFeature:PrePoint(ctx) end
function BaseFeature:PreSpec(ctx) end
function BaseFeature:PreRequest(ctx) end
function BaseFeature:PreResponse(ctx) end
function BaseFeature:PreResult(ctx) end
function BaseFeature:PreDone(ctx) end
function BaseFeature:PreUnexpected(ctx) end


return BaseFeature
