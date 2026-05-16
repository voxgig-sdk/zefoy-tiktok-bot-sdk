# ZefoyTiktokBot SDK utility: make_result
module ZefoyTiktokBotUtilities
  MakeResult = ->(ctx) {
    return ctx.out["result"], nil if ctx.out["result"]
    utility = ctx.utility
    op = ctx.op
    entity = ctx.entity
    spec = ctx.spec
    result = ctx.result

    return nil, ctx.make_error("result_no_spec", "Expected context spec property to be defined.") unless spec
    return nil, ctx.make_error("result_no_result", "Expected context result property to be defined.") unless result

    spec.step = "result"
    utility.transform_response.call(ctx)

    if op.name == "list"
      resdata = result.resdata
      result.resdata = []
      if resdata.is_a?(Array) && !resdata.empty? && entity
        entities = resdata.map do |entry|
          ent = entity.make
          ent.data_set(entry) if entry.is_a?(Hash)
          ent
        end
        result.resdata = entities
      end
    end

    ctx.ctrl.explain["result"] = result if ctx.ctrl.explain
    return result, nil
  }
end
