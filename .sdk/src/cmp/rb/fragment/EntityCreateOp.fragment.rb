require_relative '../utility/struct/voxgig_struct'
require_relative '../core/helpers'

# EJECT-START

  # Create a new EntityName.
  #
  # @param reqdata [EntityNameCreateData, Hash, nil] body data
  # @param ctrl [Object, nil] optional per-call control
  # @return [EntityName, Hash] the created EntityName; raises ProjectNameError on failure
  def create(reqdata, ctrl = nil)
    utility = @_utility
    ctx = utility.make_context.call({
      "opname" => "create",
      "ctrl" => ctrl,
      "match" => @_match,
      "data" => @_data,
      "reqdata" => reqdata,
    }, @_entctx)

    _run_op(ctx) do
      if ctx.result
        if ctx.result.resdata
          @_data = ProjectNameHelpers.to_map(VoxgigStruct.clone(ctx.result.resdata)) || {}
        end
      end
    end
  end

# EJECT-END
