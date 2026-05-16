<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: result_body

class ZefoyTiktokBotResultBody
{
    public static function call(ZefoyTiktokBotContext $ctx): ?ZefoyTiktokBotResult
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result && $response && $response->json_func && $response->body) {
            $result->body = ($response->json_func)();
        }
        return $result;
    }
}
