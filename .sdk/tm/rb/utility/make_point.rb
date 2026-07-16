# ZefoyTiktokBot SDK utility: make_point
require_relative 'struct/voxgig_struct'
require_relative '../core/helpers'
require_relative '../core/error'
module ZefoyTiktokBotUtilities
  MakePoint = ->(ctx) {
    if ctx.out["point"]
      preset = ctx.out["point"]
      # A feature may short-circuit endpoint resolution by placing an error
      # in ctx.out["point"] (e.g. an rbac denial): surface it as the error
      # tuple slot so the operation fails before any network use.
      return nil, preset if preset.is_a?(ZefoyTiktokBotError)
      ctx.point = preset
      return ctx.point, nil
    end

    op = ctx.op
    options = ctx.options

    allow_op = VoxgigStruct.getpath(options, "allow.op") || ""
    unless allow_op.include?(op.name)
      return nil, ctx.make_error("point_op_allow",
        "Operation \"#{op.name}\" not allowed by SDK option allow.op value: \"#{allow_op}\"")
    end

    if op.points.empty?
      return nil, ctx.make_error("point_no_points",
        "Operation \"#{op.name}\" has no endpoint definitions.")
    end

    if op.points.length == 1
      ctx.point = op.points[0]
    else
      reqselector = op.input == "data" ? ctx.reqdata : ctx.reqmatch
      selector = op.input == "data" ? ctx.data : ctx.match

      point = nil
      op.points.each do |p|
        point = p
        select_def = ZefoyTiktokBotHelpers.to_map(VoxgigStruct.getprop(p, "select"))
        found = true

        if selector && select_def
          exist = VoxgigStruct.getprop(select_def, "exist")
          if exist.is_a?(Array)
            exist.each do |ek|
              rv = VoxgigStruct.getprop(reqselector, ek.to_s)
              sv = VoxgigStruct.getprop(selector, ek.to_s)
              if rv.nil? && sv.nil?
                found = false
                break
              end
            end
          end
        end

        if found
          req_action = VoxgigStruct.getprop(reqselector, "$action")
          select_action = VoxgigStruct.getprop(select_def, "$action")
          found = false if req_action != select_action
        end

        break if found
      end

      if reqselector
        req_action = VoxgigStruct.getprop(reqselector, "$action")
        if req_action && point
          point_select = ZefoyTiktokBotHelpers.to_map(VoxgigStruct.getprop(point, "select"))
          point_action = VoxgigStruct.getprop(point_select, "$action")
          if req_action != point_action
            return nil, ctx.make_error("point_action_invalid",
              "Operation \"#{op.name}\" action \"#{VoxgigStruct.stringify(req_action)}\" is not valid.")
          end
        end
      end

      ctx.point = point
    end

    return ctx.point, nil
  }
end
