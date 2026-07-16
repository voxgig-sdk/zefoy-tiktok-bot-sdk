<?php
declare(strict_types=1);

// ProjectName SDK EntityName entity

require_once __DIR__ . '/../utility/struct/Struct.php';
require_once __DIR__ . '/../core/Helpers.php';

use Voxgig\Struct\Struct;

class EntyClass
{
    private string $_name;
    private $_client;
    private $_utility;
    private array $_entopts;
    private array $_data;
    private array $_match;
    private $_entctx;

    public function __construct($client, ?array $entopts = null)
    {
        $entopts = $entopts ?? [];
        if (!isset($entopts["active"])) {
            $entopts["active"] = true;
        } elseif ($entopts["active"] === false) {
            // keep false
        } else {
            $entopts["active"] = true;
        }

        $this->_name = "entityname";
        $this->_client = $client;
        $this->_utility = $client->get_utility();
        $this->_entopts = $entopts;
        $this->_data = [];
        $this->_match = [];

        $this->_entctx = ($this->_utility->make_context)([
            "entity" => $this,
            "entopts" => $entopts,
        ], $client->get_root_ctx());

        ($this->_utility->feature_hook)($this->_entctx, "PostConstructEntity");
    }

    public function get_name(): string
    {
        return $this->_name;
    }

    public function make(): self
    {
        $opts = $this->_entopts;
        return new EntyClass($this->_client, $opts);
    }

    /**
     * @param EntityName|array $args EntityName data (assoc-array) to store.
     */
    public function data_set($args): void
    {
        if ($args) {
            $this->_data = ProjectNameHelpers::to_map(Struct::clone($args)) ?? [];
            ($this->_utility->feature_hook)($this->_entctx, "SetData");
        }
    }

    /**
     * @return EntityName|array The current EntityName data as an assoc-array.
     */
    public function data_get()
    {
        ($this->_utility->feature_hook)($this->_entctx, "GetData");
        return Struct::clone($this->_data);
    }

    /**
     * @param array $args Match filter (any subset of EntityName fields).
     */
    public function match_set($args): void
    {
        if ($args) {
            $this->_match = ProjectNameHelpers::to_map(Struct::clone($args)) ?? [];
            ($this->_utility->feature_hook)($this->_entctx, "SetMatch");
        }
    }

    /**
     * @return array The current match filter (any subset of EntityName fields).
     */
    public function match_get()
    {
        ($this->_utility->feature_hook)($this->_entctx, "GetMatch");
        return Struct::clone($this->_match);
    }

    /**
     * Feature #4: run `action` through the full pipeline and yield result
     * items, so the `streaming` feature's incremental output is reachable from
     * a generated entity (a normal op call materialises the whole result).
     * `callopts` parameterises the call:
     *   - inbound (download): yield items/chunks (from the streaming feature
     *     when active, else the materialised items);
     *   - outbound (upload): an iterable `body` in callopts is attached to the
     *     request so the transport can stream the payload;
     *   - `ctrl` (pipeline control) and `signal` (cancellation) honoured.
     */
    public function stream(string $action, ?array $args = null, ?array $callopts = null): \Generator
    {
        $utility = $this->_utility;
        $callopts = $callopts ?? [];
        $signal = $callopts['signal'] ?? null;

        $ctrl = is_array($callopts['ctrl'] ?? null) ? $callopts['ctrl'] : [];
        $ctrl['stream'] = $callopts;

        $ctxmap = [
            "opname" => $action,
            "ctrl" => $ctrl,
            "match" => $this->_match,
            "data" => $this->_data,
        ];
        if (is_array($args)) {
            foreach ($args as $k => $v) {
                $ctxmap[$k] = $v;
            }
        }

        $ctx = ($utility->make_context)($ctxmap, $this->_entctx);

        // Outbound: expose the caller's iterable payload so the request builder
        // / transport can stream it as the request body.
        $body = $callopts['body'] ?? null;
        if ($body !== null) {
            $ctx->reqdata['body$'] = $body;
            $ctx->meta['stream_out'] = $body;
        }

        $aborted = function () use ($signal): bool {
            if ($signal === null) {
                return false;
            }
            if (is_callable($signal)) {
                return (bool)$signal();
            }
            if (is_object($signal) && isset($signal->aborted)) {
                return (bool)$signal->aborted;
            }
            return false;
        };

        ($utility->feature_hook)($ctx, "PrePoint");
        [$point, $err] = ($utility->make_point)($ctx);
        $ctx->out["point"] = $point;
        if ($err) {
            return;
        }

        ($utility->feature_hook)($ctx, "PreSpec");
        [$spec, $err] = ($utility->make_spec)($ctx);
        $ctx->out["spec"] = $spec;
        if ($err) {
            return;
        }

        ($utility->feature_hook)($ctx, "PreRequest");
        [$resp, $err] = ($utility->make_request)($ctx);
        $ctx->out["request"] = $resp;
        if ($err) {
            return;
        }

        ($utility->feature_hook)($ctx, "PreResponse");
        [$resp2, $err] = ($utility->make_response)($ctx);
        $ctx->out["response"] = $resp2;
        if ($err) {
            return;
        }

        ($utility->feature_hook)($ctx, "PreResult");
        [$result, $err] = ($utility->make_result)($ctx);
        $ctx->out["result"] = $result;
        if ($err) {
            return;
        }

        ($utility->feature_hook)($ctx, "PreDone");

        $result = $ctx->result;

        // Inbound: prefer the streaming feature's incremental generator; else
        // fall back to the materialised items so stream always yields.
        $streamfn = ($result !== null && isset($result->stream) && is_callable($result->stream))
            ? $result->stream : null;
        if ($streamfn !== null) {
            foreach ($streamfn() as $item) {
                if ($aborted()) {
                    return;
                }
                yield $item;
            }
            return;
        }

        $data = ($utility->done)($ctx);
        if (is_array($data) && array_is_list($data)) {
            $items = $data;
        } elseif ($data === null) {
            $items = [];
        } else {
            $items = [$data];
        }
        foreach ($items as $item) {
            if ($aborted()) {
                return;
            }
            yield $item;
        }
    }

    // #LoadOp

    // #ListOp

    // #CreateOp

    // #UpdateOp

    // #RemoveOp

    private function _run_op($ctx, callable $post_done): mixed
    {
        $utility = $this->_utility;

        // #PrePoint-Hook

        [$point, $err] = ($utility->make_point)($ctx);
        $ctx->out["point"] = $point;
        if ($err) {
            return ($utility->make_error)($ctx, $err);
        }

        // #PreSpec-Hook

        [$spec, $err] = ($utility->make_spec)($ctx);
        $ctx->out["spec"] = $spec;
        if ($err) {
            return ($utility->make_error)($ctx, $err);
        }

        // #PreRequest-Hook

        [$resp, $err] = ($utility->make_request)($ctx);
        $ctx->out["request"] = $resp;
        if ($err) {
            return ($utility->make_error)($ctx, $err);
        }

        // #PreResponse-Hook

        [$resp2, $err] = ($utility->make_response)($ctx);
        $ctx->out["response"] = $resp2;
        if ($err) {
            return ($utility->make_error)($ctx, $err);
        }

        // #PreResult-Hook

        [$result, $err] = ($utility->make_result)($ctx);
        $ctx->out["result"] = $result;
        if ($err) {
            return ($utility->make_error)($ctx, $err);
        }

        // #PreDone-Hook

        $post_done();

        return ($utility->done)($ctx);
    }
}
