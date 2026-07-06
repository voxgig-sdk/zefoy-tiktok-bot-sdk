require_relative '../utility/struct/voxgig_struct'
require_relative '../core/helpers'

# EJECT-START

  # Load a single EntityName.
  #
  # @param reqmatch [EntityNameLoadMatch, Hash, nil] match criteria (id/query fields);
  #   optional — an entity with no id-like key loads with no match (nil is treated
  #   as an empty match, so client.EntityName.load works with no args).
  # @param ctrl [Object, nil] optional per-call control
  # @return [EntityName, Hash] the loaded EntityName; raises ProjectNameError on failure
  def load(reqmatch = nil, ctrl = nil)
    utility = @_utility
    ctx = utility.make_context.call({
      "opname" => "load",
      "ctrl" => ctrl,
      "match" => @_match,
      "data" => @_data,
      "reqmatch" => reqmatch,
    }, @_entctx)

    _run_op(ctx) do
      if ctx.result
        @_match = ctx.result.resmatch if ctx.result.resmatch
        if ctx.result.resdata
          @_data = ProjectNameHelpers.to_map(VoxgigStruct.clone(ctx.result.resdata)) || {}
        end
      end
    end
  end

# EJECT-END
