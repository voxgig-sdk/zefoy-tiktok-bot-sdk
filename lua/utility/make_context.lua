-- ZefoyTiktokBot SDK utility: make_context

local Context = require("core.context")

local function make_context_util(ctxmap, basectx)
  return Context.new(ctxmap, basectx)
end

return make_context_util
