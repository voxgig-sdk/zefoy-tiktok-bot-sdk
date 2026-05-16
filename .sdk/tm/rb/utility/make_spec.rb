# ZefoyTiktokBot SDK utility: make_spec
require_relative 'struct/voxgig_struct'
require_relative '../core/spec'
module ZefoyTiktokBotUtilities
  MakeSpec = ->(ctx) {
    if ctx.out["spec"]
      ctx.spec = ctx.out["spec"]
      return ctx.spec, nil
    end

    point = ctx.point
    options = ctx.options
    utility = ctx.utility

    base = VoxgigStruct.getprop(options, "base") || ""
    prefix = VoxgigStruct.getprop(options, "prefix") || ""
    suffix = VoxgigStruct.getprop(options, "suffix") || ""

    parts = []
    parts = VoxgigStruct.getprop(point, "parts") if point
    parts = [] unless parts.is_a?(Array)

    ctx.spec = ZefoyTiktokBotSpec.new({
      "base" => base, "prefix" => prefix, "parts" => parts,
      "suffix" => suffix, "step" => "start",
    })

    ctx.spec.method = utility.prepare_method.call(ctx)

    allow_method = VoxgigStruct.getpath(options, "allow.method") || ""
    unless allow_method.include?(ctx.spec.method)
      return nil, ctx.make_error("spec_method_allow",
        "Method \"#{ctx.spec.method}\" not allowed by SDK option allow.method value: \"#{allow_method}\"")
    end

    ctx.spec.params = utility.prepare_params.call(ctx)
    ctx.spec.query = utility.prepare_query.call(ctx)
    ctx.spec.headers = utility.prepare_headers.call(ctx)
    ctx.spec.body = utility.prepare_body.call(ctx)
    ctx.spec.path = utility.prepare_path.call(ctx)

    ctx.ctrl.explain["spec"] = ctx.spec if ctx.ctrl.explain

    spec, err = utility.prepare_auth.call(ctx)
    return nil, err if err

    ctx.spec = spec
    return spec, nil
  }
end
