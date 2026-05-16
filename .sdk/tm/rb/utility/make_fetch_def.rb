# ZefoyTiktokBot SDK utility: make_fetch_def
require_relative 'struct/voxgig_struct'
require_relative '../core/result'
module ZefoyTiktokBotUtilities
  MakeFetchDef = ->(ctx) {
    spec = ctx.spec
    return nil, ctx.make_error("fetchdef_no_spec", "Expected context spec property to be defined.") unless spec

    ctx.result = ZefoyTiktokBotResult.new({}) unless ctx.result
    spec.step = "prepare"

    url, err = ctx.utility.make_url.call(ctx)
    return nil, err if err

    spec.url = url

    fetchdef = { "url" => url, "method" => spec.method, "headers" => spec.headers }
    if spec.body
      fetchdef["body"] = spec.body.is_a?(Hash) ? VoxgigStruct.jsonify(spec.body) : spec.body
    end

    return fetchdef, nil
  }
end
