require_relative '../utility/struct/voxgig_struct'
require_relative '../core/helpers'

# EJECT-START

  # Remove an EntityName matching the given criteria.
  #
  # @param reqmatch [EntityNameRemoveMatch, Hash, nil] match criteria (id/query fields)
  # @param ctrl [Object, nil] optional per-call control
  # @return [EntityName, Hash] the removed EntityName; raises ProjectNameError on failure
  def remove(reqmatch, ctrl = nil)
    utility = @_utility
    ctx = utility.make_context.call({
      "opname" => "remove",
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
