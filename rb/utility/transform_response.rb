# ZefoyTiktokBot SDK utility: transform_response
require_relative 'struct/voxgig_struct'
require_relative '../core/helpers'
module ZefoyTiktokBotUtilities
  TransformResponse = ->(ctx) {
    spec = ctx.spec
    result = ctx.result
    point = ctx.point
    spec.step = "resform" if spec
    return nil if result.nil? || !result.ok
    transform = ZefoyTiktokBotHelpers.to_map(VoxgigStruct.getprop(point, "transform"))
    return nil unless transform
    resform = VoxgigStruct.getprop(transform, "res")
    return nil unless resform
    resdata = VoxgigStruct.transform({
      "ok" => result.ok, "status" => result.status, "statusText" => result.status_text,
      "headers" => result.headers, "body" => result.body, "err" => result.err,
      "resdata" => result.resdata, "resmatch" => result.resmatch,
    }, resform)
    result.resdata = resdata
    resdata
  }
end
