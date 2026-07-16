<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK proxy feature

require_once __DIR__ . '/BaseFeature.php';

// Outbound HTTP(S) proxy support. Wraps the active transport and attaches
// proxy routing to each request's fetch definition. The proxy target comes
// from options (`url`) or, when `fromEnv` is set, the standard
// HTTPS_PROXY / HTTP_PROXY / NO_PROXY environment variables. Constructing a
// concrete transport handle is dependency-specific, so a factory may be
// supplied via `options['agent']`; when absent the request is annotated
// with `fetchdef['proxy']` for the transport to honour. Hosts matching
// `noProxy` (exact or dot-suffix, `*` for all) bypass the proxy. Mirrors
// ts/src/feature/proxy/ProxyFeature.ts.
class ZefoyTiktokBotProxyFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private ?string $url;
    private array $no_proxy;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'proxy';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->url = null;
        $this->no_proxy = [];
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;

        if (!$this->active) {
            return;
        }

        $url = $options['url'] ?? null;
        $this->url = (is_string($url) && $url !== '') ? $url : null;
        $no_proxy = $options['noProxy'] ?? null;

        if (($options['fromEnv'] ?? null) === true) {
            $this->url = $this->url
                ?? $this->_env('HTTPS_PROXY') ?? $this->_env('https_proxy')
                ?? $this->_env('HTTP_PROXY') ?? $this->_env('http_proxy');
            if ($no_proxy === null) {
                $no_proxy = $this->_env('NO_PROXY') ?? $this->_env('no_proxy');
            }
        }

        if (is_string($no_proxy)) {
            $no_proxy = preg_split('/\s*,\s*/', $no_proxy) ?: [];
        }
        $this->no_proxy = [];
        if (is_array($no_proxy)) {
            foreach ($no_proxy as $np) {
                if (is_string($np) && $np !== '') {
                    $this->no_proxy[] = $np;
                }
            }
        }

        $utility = $ctx->utility;
        $inner = $utility->fetcher;

        $utility->fetcher = function (ZefoyTiktokBotContext $ctx2, string $url2, array $fetchdef) use ($inner): array {
            $fetchdef = $this->_route($url2, $fetchdef);
            return $inner($ctx2, $url2, $fetchdef);
        };
    }

    private function _route(string $url, array $fetchdef): array
    {
        if ($this->url === null || $this->_bypass($url)) {
            return $fetchdef;
        }

        $fetchdef['proxy'] = $this->url;

        $agent = $this->options['agent'] ?? null;
        if (is_callable($agent)) {
            // Factory returns a transport-specific handle (e.g. a configured
            // cURL/stream context builder).
            $made = $agent($this->url, $url);
            $fetchdef['dispatcher'] = $made;
            $fetchdef['agent'] = $made;
        }

        $this->_track($url);
        return $fetchdef;
    }

    private function _bypass(string $url): bool
    {
        if (count($this->no_proxy) === 0) {
            return false;
        }
        $host = $url;
        if (preg_match('/^[a-z]+:\/\/([^\/:]+)/i', $url, $m)) {
            $host = $m[1];
        }
        foreach ($this->no_proxy as $np) {
            if ($np === '*') {
                return true;
            }
            $suffix = '.' . ltrim($np, '.');
            if ($host === $np || str_ends_with($host, $suffix)) {
                return true;
            }
        }
        return false;
    }

    private function _env(string $name): ?string
    {
        $v = getenv($name);
        return (is_string($v) && $v !== '') ? $v : null;
    }

    private function _track(string $_url): void
    {
        $client = $this->client;
        if (!isset($client->_proxy)) {
            $client->_proxy = ['routed' => 0, 'url' => $this->url];
        }
        $client->_proxy['routed']++;
    }
}
