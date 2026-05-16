<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK spec

class ZefoyTiktokBotSpec
{
    public array $parts;
    public array $headers;
    public array $alias_map;
    public string $base;
    public string $prefix;
    public string $suffix;
    public array $params;
    public array $query;
    public string $step;
    public string $method;
    public mixed $body;
    public string $url;
    public string $path;

    public function __construct(array $specmap = [])
    {
        $this->parts = $specmap['parts'] ?? [];
        $this->headers = $specmap['headers'] ?? [];
        $this->alias_map = $specmap['alias'] ?? [];
        $this->base = $specmap['base'] ?? '';
        $this->prefix = $specmap['prefix'] ?? '';
        $this->suffix = $specmap['suffix'] ?? '';
        $this->params = $specmap['params'] ?? [];
        $this->query = $specmap['query'] ?? [];
        $this->step = $specmap['step'] ?? '';
        $this->method = $specmap['method'] ?? 'GET';
        $this->body = $specmap['body'] ?? null;
        $this->url = $specmap['url'] ?? '';
        $this->path = $specmap['path'] ?? '';
    }
}
