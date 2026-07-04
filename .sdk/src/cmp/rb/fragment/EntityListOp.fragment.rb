# EJECT-START

  # List EntityName items matching the given filter.
  #
  # @param reqmatch [EntityNameListMatch, Hash, nil] match filter (any subset of EntityName fields)
  # @param ctrl [Object, nil] optional per-call control
  # @return [Array<EntityName>, Array] the matching EntityName items; raises ProjectNameError on failure
  def list(reqmatch, ctrl = nil)
    utility = @_utility
    ctx = utility.make_context.call({
      "opname" => "list",
      "ctrl" => ctrl,
      "match" => @_match,
      "data" => @_data,
      "reqmatch" => reqmatch,
    }, @_entctx)

    _run_op(ctx) do
      if ctx.result
        @_match = ctx.result.resmatch if ctx.result.resmatch
      end
    end
  end

# EJECT-END
