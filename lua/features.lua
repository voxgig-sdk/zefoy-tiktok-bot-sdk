-- ProjectName SDK feature factory

local BaseFeature = require("feature.base_feature")
local TestFeature = require("feature.test_feature")


local features = {}

features.base = function()
  return BaseFeature.new()
end

features["test"] = function()
  return TestFeature.new()
end


return features
