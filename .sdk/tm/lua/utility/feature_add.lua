-- ZefoyTiktokBot SDK utility: feature_add

local function feature_add_util(ctx, f)
  local client = ctx.client
  table.insert(client.features, f)
end

return feature_add_util
