<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: result_headers

class ZefoyTiktokBotResultHeaders
{
    public static function call(ZefoyTiktokBotContext $ctx): ?ZefoyTiktokBotResult
    {
        $response = $ctx->response;
        $result = $ctx->result;
        if ($result) {
            if ($response && is_array($response->headers)) {
                $result->headers = $response->headers;
            } else {
                $result->headers = [];
            }
        }
        return $result;
    }
}
