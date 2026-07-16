# ProjectName SDK EntityName entity

require_relative '../utility/struct/voxgig_struct'
require_relative '../core/helpers'

class EntyClass
  def initialize(client, entopts = nil)
    entopts ||= {}
    if entopts["active"].nil?
      entopts["active"] = true
    elsif entopts["active"] == false
      # keep false
    else
      entopts["active"] = true
    end

    @_name = "entityname"
    @_client = client
    @_utility = client.get_utility
    @_entopts = entopts
    @_data = {}
    @_match = {}

    @_entctx = @_utility.make_context.call({
      "entity" => self,
      "entopts" => entopts,
    }, client.get_root_ctx)

    @_utility.feature_hook.call(@_entctx, "PostConstructEntity")
  end

  def get_name
    @_name
  end

  def make
    opts = @_entopts.dup
    EntyClass.new(@_client, opts)
  end

  def data_set(args)
    if args
      @_data = ProjectNameHelpers.to_map(VoxgigStruct.clone(args)) || {}
      @_utility.feature_hook.call(@_entctx, "SetData")
    end
  end

  # @return [EntityName, Hash] the current EntityName data
  def data_get
    @_utility.feature_hook.call(@_entctx, "GetData")
    VoxgigStruct.clone(@_data)
  end

  def match_set(args)
    if args
      @_match = ProjectNameHelpers.to_map(VoxgigStruct.clone(args)) || {}
      @_utility.feature_hook.call(@_entctx, "SetMatch")
    end
  end

  # @return [Hash] the current match filter (any subset of EntityName fields)
  def match_get
    @_utility.feature_hook.call(@_entctx, "GetMatch")
    VoxgigStruct.clone(@_match)
  end

  # Feature #4: run `action` through the full pipeline and return an Enumerator
  # over result items, so the `streaming` feature's incremental output is
  # reachable from a generated entity (a normal op call materialises the whole
  # result). `callopts` parameterises the call:
  #   - inbound (download): the Enumerator yields items/chunks (from the
  #     streaming feature when active, else the materialised items);
  #   - outbound (upload): an iterable `body` in callopts is attached to the
  #     request so the transport can stream the payload;
  #   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.
  def stream(action, args = nil, callopts = nil)
    utility = @_utility
    callopts ||= {}
    signal = callopts["signal"]

    ctrl = callopts["ctrl"].is_a?(Hash) ? callopts["ctrl"].dup : {}
    ctrl["stream"] = callopts

    ctxmap = {
      "opname" => action,
      "ctrl" => ctrl,
      "match" => @_match,
      "data" => @_data,
    }
    args.each { |k, v| ctxmap[k] = v } if args.is_a?(Hash)

    ctx = utility.make_context.call(ctxmap, @_entctx)

    # Outbound: expose the caller's iterable payload so the request builder /
    # transport can stream it as the request body.
    body = callopts["body"]
    unless body.nil?
      ctx.reqdata["body$"] = body
      ctx.meta["stream_out"] = body
    end

    aborted = lambda do
      return false if signal.nil?
      return !!signal.call if signal.respond_to?(:call)
      return !!signal.aborted if signal.respond_to?(:aborted)
      false
    end

    Enumerator.new do |yielder|
      catch(:stream_stop) do
        utility.feature_hook.call(ctx, "PrePoint")
        point, err = utility.make_point.call(ctx)
        ctx.out["point"] = point
        throw :stream_stop if err

        utility.feature_hook.call(ctx, "PreSpec")
        spec, err = utility.make_spec.call(ctx)
        ctx.out["spec"] = spec
        throw :stream_stop if err

        utility.feature_hook.call(ctx, "PreRequest")
        resp, err = utility.make_request.call(ctx)
        ctx.out["request"] = resp
        throw :stream_stop if err

        utility.feature_hook.call(ctx, "PreResponse")
        resp2, err = utility.make_response.call(ctx)
        ctx.out["response"] = resp2
        throw :stream_stop if err

        utility.feature_hook.call(ctx, "PreResult")
        result, err = utility.make_result.call(ctx)
        ctx.out["result"] = result
        throw :stream_stop if err

        utility.feature_hook.call(ctx, "PreDone")

        result = ctx.result

        # Inbound: prefer the streaming feature's incremental Enumerator; else
        # fall back to the materialised items so stream always yields.
        stream_enum = result ? result.stream : nil
        if stream_enum
          stream_enum.each do |item|
            throw :stream_stop if aborted.call
            yielder << item
          end
        else
          data = utility.done.call(ctx)
          items = data.is_a?(Array) ? data : (data.nil? ? [] : [data])
          items.each do |item|
            throw :stream_stop if aborted.call
            yielder << item
          end
        end
      end
    end
  end

  # #LoadOp

  # #ListOp

  # #CreateOp

  # #UpdateOp

  # #RemoveOp

  private

  def _run_op(ctx, &post_done)
    utility = @_utility

    begin
      # #PrePoint-Hook

      point, err = utility.make_point.call(ctx)
      ctx.out["point"] = point
      return utility.make_error.call(ctx, err) if err

      # #PreSpec-Hook

      spec, err = utility.make_spec.call(ctx)
      ctx.out["spec"] = spec
      return utility.make_error.call(ctx, err) if err

      # #PreRequest-Hook

      resp, err = utility.make_request.call(ctx)
      ctx.out["request"] = resp
      return utility.make_error.call(ctx, err) if err

      # #PreResponse-Hook

      resp2, err = utility.make_response.call(ctx)
      ctx.out["response"] = resp2
      return utility.make_error.call(ctx, err) if err

      # #PreResult-Hook

      result, err = utility.make_result.call(ctx)
      ctx.out["result"] = result
      return utility.make_error.call(ctx, err) if err

      # #PreDone-Hook

      post_done.call

      utility.done.call(ctx)
    rescue StandardError => operr
      # #PreUnexpected-Hook

      raise operr
    end
  end
end
