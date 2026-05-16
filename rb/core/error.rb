# ZefoyTiktokBot SDK error

class ZefoyTiktokBotError < StandardError
  attr_accessor :is_sdk_error, :sdk, :code, :msg, :ctx, :result, :spec

  def initialize(code = "", msg = "", ctx = nil)
    super(msg)
    @is_sdk_error = true
    @sdk = "ZefoyTiktokBot"
    @code = code
    @msg = msg
    @ctx = ctx
    @result = nil
    @spec = nil
  end

  def error
    @msg
  end

  def to_s
    @msg
  end
end
