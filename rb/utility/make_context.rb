# ZefoyTiktokBot SDK utility: make_context
require_relative '../core/context'
module ZefoyTiktokBotUtilities
  MakeContext = ->(ctxmap, basectx) {
    ZefoyTiktokBotContext.new(ctxmap, basectx)
  }
end
