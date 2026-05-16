# ZefoyTiktokBot SDK base feature

class ZefoyTiktokBotBaseFeature
  attr_accessor :version, :name, :active

  def initialize
    @version = "0.0.1"
    @name = "base"
    @active = true
  end

  def get_version; @version; end
  def get_name; @name; end
  def get_active; @active; end

  def init(ctx, options); end
  def PostConstruct(ctx); end
  def PostConstructEntity(ctx); end
  def SetData(ctx); end
  def GetData(ctx); end
  def GetMatch(ctx); end
  def SetMatch(ctx); end
  def PrePoint(ctx); end
  def PreSpec(ctx); end
  def PreRequest(ctx); end
  def PreResponse(ctx); end
  def PreResult(ctx); end
  def PreDone(ctx); end
  def PreUnexpected(ctx); end
end
