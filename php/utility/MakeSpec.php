<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: make_spec

require_once __DIR__ . '/Graphql.php';

require_once __DIR__ . '/../core/Spec.php';

class ZefoyTiktokBotMakeSpec
{
    public static function call(ZefoyTiktokBotContext $ctx): array
    {
        if (isset($ctx->out['spec'])) {
            $ctx->spec = $ctx->out['spec'];
            return [$ctx->spec, null];
        }

        $point = $ctx->point;
        $options = $ctx->options;
        $utility = $ctx->utility;

        $base = \Voxgig\Struct\Struct::getprop($options, 'base') ?? '';
        $prefix = \Voxgig\Struct\Struct::getprop($options, 'prefix') ?? '';
        $suffix = \Voxgig\Struct\Struct::getprop($options, 'suffix') ?? '';

        $parts = [];
        if ($point) {
            $p = \Voxgig\Struct\Struct::getprop($point, 'parts');
            if (is_array($p)) {
                $parts = $p;
            }
        }

        $ctx->spec = new ZefoyTiktokBotSpec([
            'base' => $base, 'prefix' => $prefix, 'parts' => $parts,
            'suffix' => $suffix, 'step' => 'start',
        ]);

        $ctx->spec->method = ($utility->prepare_method)($ctx);

        $allow_method = \Voxgig\Struct\Struct::getpath($options, 'allow.method') ?? '';
        if (strpos($allow_method, $ctx->spec->method) === false) {
            return [null, $ctx->make_error('spec_method_allow',
                "Method \"{$ctx->spec->method}\" not allowed by SDK option allow.method value: \"{$allow_method}\"")];
        }

        $ctx->spec->params = ($utility->prepare_params)($ctx);
        $ctx->spec->query = ($utility->prepare_query)($ctx);
        $ctx->spec->headers = ($utility->prepare_headers)($ctx);

        if ('graphql' === \Voxgig\Struct\Struct::getprop($point, 'kind')) {
            // GraphQL addresses one endpoint: no path parts, no query
            // string, and the body carries the operation. prepare_body is
            // skipped deliberately — it only emits a body for data-input
            // ops, whereas every GraphQL op posts one, including
            // load/list/remove.
            $ctx->spec->body = ($utility->graphql_body)($ctx);
            $ctx->spec->path = '';
            // prepare_query already copied the op's match arguments into
            // the query string. Those same values are bound as operation
            // variables, so leaving them would send /graphql?id=i1.
            $ctx->spec->query = [];
            $ctx->spec->headers['content-type'] = ZefoyTiktokBotGraphql::CONTENT_TYPE;
        } else {
            $ctx->spec->body = ($utility->prepare_body)($ctx);
            $ctx->spec->path = ($utility->prepare_path)($ctx);
        }

        if ($ctx->ctrl->explain) {
            $ctx->ctrl->explain['spec'] = $ctx->spec;
        }

        [$spec, $err] = ($utility->prepare_auth)($ctx);
        if ($err) {
            return [null, $err];
        }

        $ctx->spec = $spec;
        return [$spec, null];
    }
}
