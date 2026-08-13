<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: graphql
//
// GraphQL transport. API-INDEPENDENT: every GraphQL SDK this generator
// produces uses this file unchanged. The API-specific part — which
// operations exist and what each one's document is — is model data,
// computed once by apidef and emitted into Config.
//
// Two jobs:
//
//   graphql_body   — build { query, variables } for a point, binding the
//                    op's arguments to the document's declared variables.
//
//   graphql_errors — lift a GraphQL failure into an SDK error. GraphQL
//                    reports failures as a top-level `errors` array under
//                    HTTP 200, so the status-driven path in result_basic
//                    never sees them.

class ZefoyTiktokBotGraphql
{
    // Content type every GraphQL-over-HTTP request uses.
    public const CONTENT_TYPE = 'application/json';

    // Map a GraphQL error to the same error codes the HTTP path produces,
    // so a caller handles auth or rate limiting identically on both
    // transports. Servers put the machine-readable code in
    // `extensions.code`; Linear-style APIs use `extensions.type`.
    public static function errorCode(mixed $gqlerr): string
    {
        $ext = \Voxgig\Struct\Struct::getprop($gqlerr, 'extensions');
        if (!is_array($ext)) {
            $ext = [];
        }

        $raw = \Voxgig\Struct\Struct::getprop($ext, 'code');
        if (null === $raw || '' === $raw) {
            $raw = \Voxgig\Struct\Struct::getprop($ext, 'type');
        }
        $raw = strtoupper(is_string($raw) ? $raw : '');

        if (str_contains($raw, 'AUTH') || str_contains($raw, 'FORBIDDEN')
            || str_contains($raw, 'UNAUTHENTICATED')) {
            return 'request_auth';
        }
        if (str_contains($raw, 'RATELIMIT') || str_contains($raw, 'RATE_LIMIT')
            || str_contains($raw, 'TOO_MANY')) {
            return 'request_ratelimit';
        }
        if (str_contains($raw, 'BAD_USER_INPUT') || str_contains($raw, 'VALIDATION')
            || str_contains($raw, 'INVALID')) {
            return 'request_invalid';
        }

        return 'request_graphql';
    }

    // Build the request body for a GraphQL point.
    //
    // Variables come from the op's own arguments: a named variable binds
    // to the like-named argument (`from`), and the input-object variable
    // (empty `from`) takes the request data as a whole — which is what
    // makes a generated create/update call look exactly like its REST
    // equivalent.
    public static function body(ZefoyTiktokBotContext $ctx): mixed
    {
        $gql = \Voxgig\Struct\Struct::getprop($ctx->point, 'graphql');
        if (!is_array($gql)) {
            return null;
        }

        // reqmatch/reqdata hold the caller's arguments for THIS call;
        // data/match hold the entity's current state. Which pair depends on
        // whether the op takes match or data input. A named variable falls
        // back to the current state, so updating a loaded entity with just
        // {title} still binds the stored id the mutation requires.
        $reqsrc = $ctx->reqmatch;
        $datasrc = $ctx->match;
        if (null !== $ctx->op && 'data' === $ctx->op->input) {
            $reqsrc = $ctx->reqdata;
            $datasrc = $ctx->data;
        }
        if (!is_array($reqsrc)) {
            $reqsrc = [];
        }
        if (!is_array($datasrc)) {
            $datasrc = [];
        }

        $variables = [];

        $varlist = \Voxgig\Struct\Struct::getprop($gql, 'vars');
        if (!is_array($varlist)) {
            $varlist = [];
        }

        foreach ($varlist as $spec) {
            if (!is_array($spec)) {
                continue;
            }

            $name = \Voxgig\Struct\Struct::getprop($spec, 'name');
            $from = \Voxgig\Struct\Struct::getprop($spec, 'from');

            if (null === $from || '' === $from) {
                // The input object IS the request body. Strip the action
                // selector, which is an SDK-side point discriminator, not
                // an API field.
                $body = [];
                foreach ($reqsrc as $k => $v) {
                    if ('$action' !== $k) {
                        $body[$k] = $v;
                    }
                }
                $variables[$name] = $body;
                continue;
            }

            // Only send variables the caller actually supplied: sending an
            // explicit null would clear a field on many APIs.
            $val = \Voxgig\Struct\Struct::getprop($reqsrc, $from);
            if (null === $val) {
                $val = \Voxgig\Struct\Struct::getprop($datasrc, $from);
            }
            if (null !== $val) {
                $variables[$name] = $val;
            }
        }

        return [
            'query' => \Voxgig\Struct\Struct::getprop($gql, 'doc'),
            'variables' => $variables,
        ];
    }

    // Inspect a decoded GraphQL response body and record a failure when
    // the server reported one. Returns true when an error was recorded.
    //
    // Partial data (`data` alongside `errors`) is treated as failure: the
    // REST surface has no partial-success concept, and silently returning
    // half an object would be worse than failing. The raw envelope stays
    // available on the result for callers that need it.
    public static function errors(ZefoyTiktokBotContext $ctx): bool
    {
        $result = $ctx->result;
        $point = $ctx->point;

        if (null === $result || null === $point) {
            return false;
        }

        if ('graphql' !== \Voxgig\Struct\Struct::getprop($point, 'kind')) {
            return false;
        }

        $errors = \Voxgig\Struct\Struct::getprop($result->body, 'errors');
        if (!is_array($errors) || 0 === count($errors)) {
            return false;
        }

        $first = $errors[0];
        $msg = \Voxgig\Struct\Struct::getprop($first, 'message');
        if (!is_string($msg) || '' === $msg) {
            $msg = 'graphql error';
        }
        if (1 < count($errors)) {
            $msg = $msg . ' (+' . (count($errors) - 1) . ' more)';
        }

        $result->err = $ctx->make_error(self::errorCode($first), 'graphql: ' . $msg);
        $result->ok = false;

        return true;
    }
}
