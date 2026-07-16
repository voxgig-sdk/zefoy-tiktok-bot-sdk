<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK clienttrack feature

require_once __DIR__ . '/BaseFeature.php';

// Client tracking. Establishes a stable per-client session id at
// construction and stamps identifying headers on every request: a
// `User-Agent` (`<clientName>/<clientVersion>`), an `X-Client-Id`
// (session), and a fresh per-request `X-Request-Id`. This lets a server
// correlate all traffic from one SDK instance and each individual call.
// Caller-provided User-Agent / X-Client-Id values are never clobbered.
// Header names, client name/version and the id generator (`idgen`) are
// configurable; the session id and request counter are exposed on
// `client->_clienttrack`. Mirrors
// ts/src/feature/clienttrack/ClienttrackFeature.ts.
class ZefoyTiktokBotClienttrackFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;
    private string $session;
    private int $requests;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'clienttrack';
        $this->active = true;
        $this->client = null;
        $this->options = null;
        $this->session = '';
        $this->requests = 0;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
        $this->requests = 0;
    }

    public function PostConstruct(ZefoyTiktokBotContext $_ctx): void
    {
        if (!$this->active) {
            return;
        }
        $sid = $this->options['sessionId'] ?? null;
        $this->session = (is_string($sid) && $sid !== '') ? $sid : $this->_genid('session');
        $this->client->_clienttrack = [
            'session' => $this->session,
            'requests' => 0,
            'clientName' => $this->_name(),
        ];
    }

    public function PreRequest(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active) {
            return;
        }
        $spec = $ctx->spec;
        if ($spec === null) {
            return;
        }
        if ($this->session === '') {
            // PreRequest before PostConstruct: lazily create the session id.
            $sid = $this->options['sessionId'] ?? null;
            $this->session = (is_string($sid) && $sid !== '') ? $sid : $this->_genid('session');
        }

        $h = $this->options['headers'] ?? [];
        if (!is_array($h)) {
            $h = [];
        }
        $this->requests++;
        $request_id = $this->_genid('request');

        $this->_set($spec->headers, $h['agent'] ?? 'User-Agent', $this->_name());
        $this->_set($spec->headers, $h['client'] ?? 'X-Client-Id', $this->session);
        $spec->headers[$h['request'] ?? 'X-Request-Id'] = $request_id;

        $client = $this->client;
        if (!isset($client->_clienttrack)) {
            $client->_clienttrack = [
                'session' => $this->session,
                'requests' => 0,
                'clientName' => $this->_name(),
            ];
        }
        $client->_clienttrack['requests'] = $this->requests;
        $client->_clienttrack['lastRequestId'] = $request_id;
    }

    // Do not clobber a caller-provided value (e.g. a custom User-Agent).
    private function _set(array &$headers, string $name, string $value): void
    {
        $lower = strtolower($name);
        foreach ($headers as $k => $_v) {
            if (is_string($k) && strtolower($k) === $lower) {
                return;
            }
        }
        $headers[$name] = $value;
    }

    private function _name(): string
    {
        $name = $this->options['clientName'] ?? null;
        $name = (is_string($name) && $name !== '') ? $name : 'ZefoyTiktokBot-SDK';
        $version = $this->options['clientVersion'] ?? null;
        $version = (is_string($version) && $version !== '') ? $version : '0.0.1';
        return $name . '/' . $version;
    }

    private function _genid(string $kind): string
    {
        $idgen = $this->options['idgen'] ?? null;
        if (is_callable($idgen)) {
            return (string)$idgen($kind);
        }
        return substr($kind[0] . '-' . bin2hex(random_bytes(9)), 0, 20);
    }
}
