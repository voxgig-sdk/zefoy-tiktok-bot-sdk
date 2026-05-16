<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_result

class ZefoyTiktokBotMakeResult
{
    public static function call(ZefoyTiktokBotContext $ctx): array
    {
        if (isset($ctx->out['result'])) {
            return [$ctx->out['result'], null];
        }
        $utility = $ctx->utility;
        $op = $ctx->op;
        $entity = $ctx->entity;
        $spec = $ctx->spec;
        $result = $ctx->result;

        if (!$spec) {
            return [null, $ctx->make_error('result_no_spec', 'Expected context spec property to be defined.')];
        }
        if (!$result) {
            return [null, $ctx->make_error('result_no_result', 'Expected context result property to be defined.')];
        }

        $spec->step = 'result';
        ($utility->transform_response)($ctx);

        if ($op->name === 'list') {
            $resdata = $result->resdata;
            $result->resdata = [];
            if (is_array($resdata) && !empty($resdata) && $entity) {
                $entities = [];
                foreach ($resdata as $entry) {
                    $ent = $entity->make();
                    if ($entry instanceof \stdClass) {
                        $entry = (array)$entry;
                    }
                    if (is_array($entry)) {
                        $ent->data_set($entry);
                    }
                    $entities[] = $ent;
                }
                $result->resdata = $entities;
            }
        }

        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['result'] = $result;
        }
        return [$result, null];
    }
}
