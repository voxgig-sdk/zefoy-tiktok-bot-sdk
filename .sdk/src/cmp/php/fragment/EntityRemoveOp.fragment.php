require_once __DIR__ . '/../utility/struct/Struct.php';
require_once __DIR__ . '/../core/Helpers.php';

// EJECT-START

    /**
     * Remove an EntityName matching the given criteria.
     *
     * @param EntityNameRemoveMatch|array|null $reqmatch Match criteria (id/query
     *   fields) as an assoc-array; EntityNameRemoveMatch names the shape.
     * @param mixed $ctrl Optional per-call control overrides.
     * @return EntityName|array The removed EntityName as an assoc-array at the
     *   SDK boundary; throws ProjectNameError on failure (item-5 convention).
     */
    public function remove(?array $reqmatch = null, $ctrl = null): mixed
    {
        $utility = $this->_utility;
        $ctx = ($utility->make_context)([
            "opname" => "remove",
            "ctrl" => $ctrl,
            "match" => $this->_match,
            "data" => $this->_data,
            "reqmatch" => $reqmatch,
        ], $this->_entctx);

        return $this->_run_op($ctx, function () use ($ctx) {
            if ($ctx->result) {
                if ($ctx->result->resmatch) {
                    $this->_match = $ctx->result->resmatch;
                }
                if ($ctx->result->resdata) {
                    $this->_data = ProjectNameHelpers::to_map(Struct::clone($ctx->result->resdata)) ?? [];
                }
            }
        });
    }

// EJECT-END
