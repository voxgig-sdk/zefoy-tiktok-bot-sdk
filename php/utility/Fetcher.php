<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK utility: fetcher

class ZefoyTiktokBotFetcher
{
    // Default User-Agent — many CDNs (notably Cloudflare) reject requests
    // with PHP's default UA (which file_get_contents doesn't even set),
    // returning 403 before the request reaches the origin. Set a Mozilla-
    // shaped UA so the SDK behaves like every other HTTP client by default.
    // Users can override by passing a User-Agent header in fetchdef.
    public const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; ZefoyTiktokBotSDK/1.0)';

    public static function defaultHttpFetch(string $fullurl, array $fetchdef): array
    {
        $method_str = strtoupper($fetchdef['method'] ?? 'GET');
        $body_str = $fetchdef['body'] ?? null;
        $headers = $fetchdef['headers'] ?? [];

        $header_lines = [];
        $has_ua = false;
        foreach ($headers as $k => $v) {
            if (is_string($v)) {
                if (strcasecmp($k, 'user-agent') === 0) {
                    $has_ua = true;
                }
                $header_lines[] = "{$k}: {$v}";
            }
        }
        if (!$has_ua) {
            $header_lines[] = 'User-Agent: ' . self::DEFAULT_USER_AGENT;
        }

        // Prefer cURL when available — its header capture is reliable across
        // PHP versions, while file_get_contents + custom stream wrappers
        // don't propagate $http_response_header for user-defined wrappers
        // in PHP 8.3+. (cURL is configured with FOLLOWLOCATION off, so the
        // manual-redirect annotation below holds there by construction.)
        if (function_exists('curl_init')) {
            return self::curlFetch($fullurl, $method_str, $body_str, $header_lines);
        }

        $opts = [
            'http' => [
                'method' => $method_str,
                'ignore_errors' => true,
            ],
        ];

        // Honour a redirect annotation on the fetch definition (set by the
        // station feature's middleware under a hosts policy): "manual"
        // surfaces a 3xx as an ordinary response instead of auto-following
        // it — the http stream wrapper otherwise replays the request,
        // headers included, against whatever host Location names, carrying
        // injected credentials to a host no policy approved.
        if (($fetchdef['redirect'] ?? null) === 'manual') {
            $opts['http']['follow_location'] = 0;
        }

        if (is_string($body_str)) {
            $opts['http']['content'] = $body_str;
        }

        if (!empty($header_lines)) {
            $opts['http']['header'] = implode("\r\n", $header_lines);
        }

        $context = stream_context_create($opts);
        $response_body = @file_get_contents($fullurl, false, $context);

        $status = 0;
        $status_text = '';
        $resp_headers = [];

        $response_headers = function_exists('http_get_last_response_headers')
            ? http_get_last_response_headers()
            : ($http_response_header ?? []);

        if (is_array($response_headers)) {
            foreach ($response_headers as $header) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)\s+(.*)$/i', $header, $matches)) {
                    $status = (int)$matches[1];
                    $status_text = trim($matches[2]);
                } else {
                    $parts = explode(':', $header, 2);
                    if (count($parts) === 2) {
                        $resp_headers[strtolower(trim($parts[0]))] = trim($parts[1]);
                    }
                }
            }
        }

        $json_body = null;
        if ($response_body !== false && $response_body !== '') {
            $decoded = json_decode($response_body, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $json_body = $decoded;
            }
        }

        return [
            [
                'status' => $status,
                'statusText' => $status_text,
                'headers' => $resp_headers,
                'json' => function () use ($json_body) { return $json_body; },
                'body' => $response_body !== false ? $response_body : '',
            ],
            null,
        ];
    }

    private static function curlFetch(string $fullurl, string $method, $body_str, array $header_lines): array
    {
        // GET-only guard for live tests — set by pub-live-test. We respect
        // it here at the SDK level since cURL bypasses PHP stream wrappers
        // (so the wrapper-based guard wouldn't see this call).
        if (getenv('VOXGIG_GETONLY_GUARD') === 'TRUE' && $method !== 'GET') {
            fwrite(STDERR, "[GET-ONLY GUARD] blocked {$method} {$fullurl}\n");
            return [
                [
                    'status' => 0,
                    'statusText' => 'Blocked',
                    'headers' => [],
                    'json' => function () { return null; },
                    'body' => '',
                ],
                "GET-only guard blocked {$method} {$fullurl}",
            ];
        }

        $ch = curl_init($fullurl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HEADER, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if (!empty($header_lines)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $header_lines);
        }
        if (is_string($body_str)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body_str);
        }

        $resp_headers = [];
        curl_setopt($ch, CURLOPT_HEADERFUNCTION,
            function ($_ch, $hdr) use (&$resp_headers) {
                $trimmed = trim($hdr);
                if ($trimmed !== '') {
                    $resp_headers[] = $trimmed;
                }
                return strlen($hdr);
            });

        $response_body = curl_exec($ch);
        if ($response_body === false) {
            $err = curl_error($ch) ?: 'curl_exec failed';
            curl_close($ch);
            return [
                [
                    'status' => 0,
                    'statusText' => 'Error',
                    'headers' => [],
                    'json' => function () { return null; },
                    'body' => '',
                ],
                $err,
            ];
        }
        curl_close($ch);

        $status = 0;
        $status_text = '';
        $resp_kv = [];
        foreach ($resp_headers as $h) {
            if (preg_match('/^HTTP\/\S+\s+(\d+)\s*(.*)$/i', $h, $m)) {
                $status = (int)$m[1];
                $status_text = trim($m[2]);
            } else {
                $parts = explode(':', $h, 2);
                if (count($parts) === 2) {
                    $resp_kv[strtolower(trim($parts[0]))] = trim($parts[1]);
                }
            }
        }

        $json_body = null;
        if ($response_body !== '' && $response_body !== false) {
            $decoded = json_decode($response_body, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $json_body = $decoded;
            }
        }

        return [
            [
                'status' => $status,
                'statusText' => $status_text,
                'headers' => $resp_kv,
                'json' => function () use ($json_body) { return $json_body; },
                'body' => (string)$response_body,
            ],
            null,
        ];
    }

    public static function call(ZefoyTiktokBotContext $ctx, string $fullurl, array $fetchdef): array
    {
        if ($ctx->client->mode !== 'live') {
            return [null, $ctx->make_error('fetch_mode_block',
                "Request blocked by mode: \"{$ctx->client->mode}\" (URL was: \"{$fullurl}\")")];
        }

        $options = $ctx->client->options_map();
        if (\Voxgig\Struct\Struct::getpath($options, 'feature.test.active') === true) {
            return [null, $ctx->make_error('fetch_test_block',
                "Request blocked as test feature is active (URL was: \"{$fullurl}\")")];
        }

        $sys_fetch = \Voxgig\Struct\Struct::getpath($options, 'system.fetch');

        // Treat null OR an empty stdClass/array as "no fetcher provided" and
        // fall through to the default HTTP fetcher. The options builder
        // sometimes materializes `system.fetch` as an empty stdClass even
        // when the user didn't set one — that's a placeholder, not a value.
        $is_empty_obj = ($sys_fetch instanceof \stdClass) && empty(get_object_vars($sys_fetch));
        $is_empty_arr = is_array($sys_fetch) && empty($sys_fetch);
        if ($sys_fetch === null || $is_empty_obj || $is_empty_arr) {
            return self::defaultHttpFetch($fullurl, $fetchdef);
        }
        if (is_callable($sys_fetch)) {
            return $sys_fetch($fullurl, $fetchdef);
        }

        return [null, $ctx->make_error('fetch_invalid', 'system.fetch is not a valid function')];
    }
}
