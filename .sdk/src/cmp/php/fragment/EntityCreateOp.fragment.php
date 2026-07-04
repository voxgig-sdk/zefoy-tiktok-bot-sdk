require_once __DIR__ . '/../utility/struct/Struct.php';
require_once __DIR__ . '/../core/Helpers.php';

// EJECT-START

    /**
     * Create a new EntityName.
     *
     * @param EntityNameCreateData|array|null $reqdata Body data as an assoc-array;
     *   a typed EntityNameCreateData names the shape.
     * @param mixed $ctrl Optional per-call control overrides.
     * @return EntityName|array The created EntityName as an assoc-array at the
     *   SDK boundary; throws ProjectNameError on failure (item-5 convention).
     */
    public function create(?array $reqdata = null, $ctrl = null): mixed
    {
        $utility = $this->_utility;
        $ctx = ($utility->make_context)([
            "opname" => "create",
            "ctrl" => $ctrl,
            "match" => $this->_match,
            "data" => $this->_data,
            "reqdata" => $reqdata,
        ], $this->_entctx);

        return $this->_run_op($ctx, function () use ($ctx) {
            if ($ctx->result) {
                if ($ctx->result->resdata) {
                    $this->_data = ProjectNameHelpers::to_map(Struct::clone($ctx->result->resdata)) ?? [];
                }
            }
        });
    }

// EJECT-END
