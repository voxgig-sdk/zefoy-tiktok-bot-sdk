-- ZefoyTiktokBot SDK utility: feature_add

-- Features can position themselves relative to an already-added feature
-- via `_options` ("__before__" / "__after__" / "__replace__"), set by the
-- caller on `extend` feature instances -- mirrors the ts featureAdd. The
-- first match wins; with no match the feature is appended.
local function feature_add_util(ctx, f)
  local client = ctx.client
  local features = client.features

  local fopts = f._options or {}
  local before = fopts.__before__
  local after = fopts.__after__
  local replace = fopts.__replace__

  if before or after or replace then
    for i, ef in ipairs(features) do
      local name = ef.name
      if before == name then
        table.insert(features, i, f)
        return
      elseif after == name then
        table.insert(features, i + 1, f)
        return
      elseif replace == name then
        features[i] = f
        return
      end
    end
  end

  table.insert(features, f)
end

return feature_add_util
