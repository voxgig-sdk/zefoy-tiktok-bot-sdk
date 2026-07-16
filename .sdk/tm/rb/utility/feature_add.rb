# ZefoyTiktokBot SDK utility: feature_add
module ZefoyTiktokBotUtilities
  # Features can position themselves relative to an already-added feature
  # via `_options` ("__before__" / "__after__" / "__replace__"), set by the
  # caller on `extend` feature instances — mirrors the ts featureAdd. The
  # first match wins; with no match the feature is appended.
  FeatureAdd = ->(ctx, f) {
    features = ctx.client.features

    fopts = f.instance_variable_get(:@_options) || {}
    before = fopts["__before__"]
    after = fopts["__after__"]
    replace = fopts["__replace__"]

    if before || after || replace
      features.each_with_index do |ef, i|
        name = ef.respond_to?(:name) ? ef.name : nil
        if before == name
          features.insert(i, f)
          return
        elsif after == name
          features.insert(i + 1, f)
          return
        elsif replace == name
          features[i] = f
          return
        end
      end
    end

    features << f
  }
end
