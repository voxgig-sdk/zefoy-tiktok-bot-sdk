# ZefoyTiktokBot SDK utility: prepare_method
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  METHOD_MAP = { "create"=>"POST", "update"=>"PUT", "load"=>"GET", "list"=>"GET", "remove"=>"DELETE", "patch"=>"PATCH" }

  # The API definition is authoritative: a POST-only or PATCH-based API
  # exposes `update` as POST or PATCH, not the PUT the op name implies.
  # Only fall back to the op-name convention when the point has no method.
  PrepareMethod = ->(ctx) {
    method = VoxgigStruct.getprop(ctx.point, "method")
    next method.upcase if method.is_a?(String) && "" != method
    METHOD_MAP[ctx.op.name] || "GET"
  }
end
