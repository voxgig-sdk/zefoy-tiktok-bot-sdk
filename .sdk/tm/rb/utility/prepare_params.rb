# ZefoyTiktokBot SDK utility: prepare_params
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  PrepareParams = ->(ctx) {
    utility = ctx.utility
    point = ctx.point
    params = []
    if point
      args = VoxgigStruct.getprop(point, "args")
      if args.is_a?(Hash)
        p = VoxgigStruct.getprop(args, "params")
        params = p if p.is_a?(Array)
      end
    end
    out = {}
    params.each do |pd|
      val = utility.param.call(ctx, pd)
      if val && pd.is_a?(Hash)
        name = VoxgigStruct.getprop(pd, "name")
        out[name] = val if name.is_a?(String) && !name.empty?
      end
    end
    out
  }
end
