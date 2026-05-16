# ZefoyTiktokBot SDK utility: feature_init
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  FeatureInit = ->(ctx, f) {
    fname = f.get_name
    fopts = {}
    if ctx.options
      feature_opts = VoxgigStruct.getprop(ctx.options, "feature")
      if feature_opts.is_a?(Hash)
        fo = VoxgigStruct.getprop(feature_opts, fname)
        fopts = fo if fo.is_a?(Hash)
      end
    end
    f.init(ctx, fopts) if fopts["active"] == true
  }
end
