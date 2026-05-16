-- ZefoyTiktokBot SDK utility: feature_hook

local function feature_hook_util(ctx, name)
  local client = ctx.client
  if client == nil then
    return
  end
  local features = client.features
  if features == nil then
    return
  end

  for _, f in ipairs(features) do
    local method = f[name]
    if type(method) == "function" then
      method(f, ctx)
    end
  end
end

return feature_hook_util
