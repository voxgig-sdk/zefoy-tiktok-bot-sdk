<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_point

require_once __DIR__ . '/../core/Helpers.php';

class ZefoyTiktokBotMakePoint
{
    public static function call(ZefoyTiktokBotContext $ctx): array
    {
        if (isset($ctx->out['point'])) {
            // A PrePoint feature hook (e.g. rbac) can short-circuit endpoint
            // resolution by placing an error in ctx.out.point; surface it as
            // the pipeline error so the network is never touched (the PHP
            // analogue of the TS `ctx.out.point instanceof Error` check).
            if ($ctx->out['point'] instanceof ZefoyTiktokBotError) {
                return [null, $ctx->out['point']];
            }
            $ctx->point = $ctx->out['point'];
            return [$ctx->point, null];
        }

        $op = $ctx->op;
        $options = $ctx->options;

        $allow_op = \Voxgig\Struct\Struct::getpath($options, 'allow.op') ?? '';
        if (strpos($allow_op, $op->name) === false) {
            return [null, $ctx->make_error('point_op_allow',
                "Operation \"{$op->name}\" not allowed by SDK option allow.op value: \"{$allow_op}\"")];
        }

        if (empty($op->points)) {
            return [null, $ctx->make_error('point_no_points',
                "Operation \"{$op->name}\" has no endpoint definitions.")];
        }

        if (count($op->points) === 1) {
            $ctx->point = $op->points[0];
        } else {
            $reqselector = $op->input === 'data' ? $ctx->reqdata : $ctx->reqmatch;
            $selector = $op->input === 'data' ? $ctx->data : $ctx->match;

            $point = null;
            foreach ($op->points as $p) {
                $point = $p;
                $select_def = ZefoyTiktokBotHelpers::to_map(\Voxgig\Struct\Struct::getprop($p, 'select'));
                $found = true;

                if ($selector && $select_def) {
                    $exist = \Voxgig\Struct\Struct::getprop($select_def, 'exist');
                    if (is_array($exist)) {
                        foreach ($exist as $ek) {
                            $rv = \Voxgig\Struct\Struct::getprop($reqselector, (string)$ek);
                            $sv = \Voxgig\Struct\Struct::getprop($selector, (string)$ek);
                            if ($rv === null && $sv === null) {
                                $found = false;
                                break;
                            }
                        }
                    }
                }

                if ($found) {
                    $req_action = \Voxgig\Struct\Struct::getprop($reqselector, '$action');
                    $select_action = \Voxgig\Struct\Struct::getprop($select_def, '$action');
                    if ($req_action !== $select_action) {
                        $found = false;
                    }
                }

                if ($found) {
                    break;
                }
            }

            if ($reqselector) {
                $req_action = \Voxgig\Struct\Struct::getprop($reqselector, '$action');
                if ($req_action && $point) {
                    $point_select = ZefoyTiktokBotHelpers::to_map(\Voxgig\Struct\Struct::getprop($point, 'select'));
                    $point_action = \Voxgig\Struct\Struct::getprop($point_select, '$action');
                    if ($req_action !== $point_action) {
                        return [null, $ctx->make_error('point_action_invalid',
                            "Operation \"{$op->name}\" action \"" . \Voxgig\Struct\Struct::stringify($req_action) . "\" is not valid.")];
                    }
                }
            }

            $ctx->point = $point;
        }

        return [$ctx->point, null];
    }
}
