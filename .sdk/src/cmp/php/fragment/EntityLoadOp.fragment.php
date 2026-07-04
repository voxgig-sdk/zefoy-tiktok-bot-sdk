require_once __DIR__ . '/../utility/struct/Struct.php';
require_once __DIR__ . '/../core/Helpers.php';

// EJECT-START

    /**
     * Load a single EntityName.
     *
     * @param EntityNameLoadMatch|array|null $reqmatch Match criteria (id/query
     *   fields) as an assoc-array; a typed EntityNameLoadMatch names the shape.
     * @param mixed $ctrl Optional per-call control overrides.
     * @return EntityName|array The loaded EntityName as an assoc-array at the
     *   SDK boundary; throws ProjectNameError on failure (item-5 convention).
     */
    public function load(?array $reqmatch = null, $ctrl = null): mixed
    {
        $utility = $this->_utility;
        $ctx = ($utility->make_context)([
            "opname" => "load",
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
