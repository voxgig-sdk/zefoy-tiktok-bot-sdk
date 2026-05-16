# ZefoyTiktokBot SDK feature factory

require_relative 'feature/base_feature'
require_relative 'feature/test_feature'


module ZefoyTiktokBotFeatures
  def self.make_feature(name)
    case name
    when "base"
      ZefoyTiktokBotBaseFeature.new
    when "test"
      ZefoyTiktokBotTestFeature.new
    else
      ZefoyTiktokBotBaseFeature.new
    end
  end
end
