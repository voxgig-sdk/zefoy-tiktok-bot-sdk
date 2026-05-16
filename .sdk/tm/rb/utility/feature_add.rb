# ZefoyTiktokBot SDK utility: feature_add
module ZefoyTiktokBotUtilities
  FeatureAdd = ->(ctx, f) {
    ctx.client.features << f
  }
end
