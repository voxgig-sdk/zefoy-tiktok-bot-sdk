# ZefoyTiktokBot SDK log feature

require_relative 'base_feature'

class ZefoyTiktokBotLogFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "log"
    @active = true
    @client = nil
    @options = nil
    @logger = nil
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options
    @active = options["active"] == true

    if @active
      if options["logger"]
        @logger = options["logger"]
      else
        @logger = $stderr
      end
    end
  end

  def _loghook(hook, ctx, level = "info")
    return unless @logger
    opname = ctx.op ? ctx.op.name : ""
    msg = "hook=#{hook} op=#{opname}"
    if @logger.respond_to?(:puts)
      @logger.puts("[#{level.upcase}] #{msg}")
    end
  end

  def PostConstruct(ctx); _loghook("PostConstruct", ctx); end
  def PostConstructEntity(ctx); _loghook("PostConstructEntity", ctx); end
  def SetData(ctx); _loghook("SetData", ctx); end
  def GetData(ctx); _loghook("GetData", ctx); end
  def SetMatch(ctx); _loghook("SetMatch", ctx); end
  def GetMatch(ctx); _loghook("GetMatch", ctx); end
  def PrePoint(ctx); _loghook("PrePoint", ctx); end
  def PreSpec(ctx); _loghook("PreSpec", ctx); end
  def PreRequest(ctx); _loghook("PreRequest", ctx); end
  def PreResponse(ctx); _loghook("PreResponse", ctx); end
  def PreResult(ctx); _loghook("PreResult", ctx); end
end
