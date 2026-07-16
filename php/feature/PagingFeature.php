<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK paging feature

require_once __DIR__ . '/BaseFeature.php';

// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records
// them on `$ctx->result->paging`. A per-call `ctrl->paging` (page or
// cursor) takes priority over the stamped defaults; parameter names and
// page size are configurable; `startPage` defaults to 1. Mirrors
// ts/src/feature/paging/PagingFeature.ts.
class ZefoyTiktokBotPagingFeature extends ZefoyTiktokBotBaseFeature
{
    private mixed $client;
    private ?array $options;

    public function __construct()
    {
        parent::__construct();
        $this->version = '0.0.1';
        $this->name = 'paging';
        $this->active = true;
        $this->client = null;
        $this->options = null;
    }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void
    {
        $this->client = $ctx->client;
        $this->options = $options;
        $this->active = ($options['active'] ?? null) === true;
    }

    public function PreRequest(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || !$this->_is_list($ctx)) {
            return;
        }
        $spec = $ctx->spec;
        if ($spec === null) {
            return;
        }

        $page_param = $this->options['pageParam'] ?? 'page';
        $limit_param = $this->options['limitParam'] ?? 'limit';
        $cursor_param = $this->options['cursorParam'] ?? 'cursor';

        // A per-call cursor/page from ctrl takes priority (used by
        // auto-iteration). ctrl->paging is an optional extension property.
        $paging = $ctx->ctrl->paging ?? null;
        if (!is_array($paging)) {
            $paging = [];
        }

        if (($paging['cursor'] ?? null) !== null) {
            $spec->query[$cursor_param] = $paging['cursor'];
        } elseif (($spec->query[$page_param] ?? null) === null) {
            $start_page = is_numeric($this->options['startPage'] ?? null)
                ? $this->options['startPage'] : 1;
            $spec->query[$page_param] = ($paging['page'] ?? null) !== null
                ? $paging['page'] : $start_page;
        }

        if (($this->options['limit'] ?? null) !== null
            && ($spec->query[$limit_param] ?? null) === null) {
            $spec->query[$limit_param] = $this->options['limit'];
        }
    }

    public function PreResult(ZefoyTiktokBotContext $ctx): void
    {
        if (!$this->active || !$this->_is_list($ctx)) {
            return;
        }
        $result = $ctx->result;
        if ($result === null) {
            return;
        }

        $headers = is_array($result->headers) ? $result->headers : [];
        $body = $result->body;

        $paging = [
            'page' => $this->_num($this->_header($headers, 'x-page')),
            'totalCount' => $this->_num($this->_header($headers, 'x-total-count')),
            'nextPage' => $this->_num($this->_header($headers, 'x-next-page')),
            'next' => null,
            'cursor' => null,
            'hasMore' => false,
        ];

        // Link: <...>; rel="next"
        $link = $this->_header($headers, 'link');
        if (is_string($link) && preg_match('/<([^>]+)>\s*;\s*rel="?next"?/i', $link, $m)) {
            $paging['next'] = $m[1];
        }

        // Body-level cursors.
        if (is_array($body)) {
            if (($body['next'] ?? null) !== null) {
                $paging['next'] = $paging['next'] ?? $body['next'];
            }
            if (($body['cursor'] ?? null) !== null) {
                $paging['cursor'] = $body['cursor'];
            }
            if (($body['nextCursor'] ?? null) !== null) {
                $paging['cursor'] = $body['nextCursor'];
            }
            if (is_bool($body['hasMore'] ?? null)) {
                $paging['hasMore'] = $body['hasMore'];
            }
        }

        $paging['hasMore'] = $paging['hasMore']
            || $paging['next'] !== null
            || $paging['cursor'] !== null
            || $paging['nextPage'] !== null;

        $result->paging = $paging;

        $this->client->_paging = ['last' => $paging];
    }

    private function _is_list(ZefoyTiktokBotContext $ctx): bool
    {
        $ops = $this->options['ops'] ?? ['list'];
        return is_array($ops) && in_array($ctx->op->name, $ops, true);
    }

    private function _header(array $headers, string $name): mixed
    {
        $lower = strtolower($name);
        foreach ($headers as $k => $v) {
            if (is_string($k) && strtolower($k) === $lower) {
                return $v;
            }
        }
        return null;
    }

    private function _num(mixed $v): mixed
    {
        if ($v === null || !is_numeric($v)) {
            return null;
        }
        return $v + 0;
    }
}
