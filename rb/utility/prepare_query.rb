# ZefoyTiktokBot SDK utility: prepare_query
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  PrepareQuery = ->(ctx) {
    point = ctx.point
    reqmatch = ctx.reqmatch || {}
    params = []
    if point
      p = VoxgigStruct.getprop(point, "params")
      params = p if p.is_a?(Array)
    end
    out = {}
    items = VoxgigStruct.items(reqmatch)
    if items
      items.each do |item|
        key, val = item[0], item[1]
        out[key] = val if val && key.is_a?(String) && !params.include?(key)
      end
    end
    out
  }
end
