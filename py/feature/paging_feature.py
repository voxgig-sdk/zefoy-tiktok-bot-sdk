# ZefoyTiktokBot SDK paging feature

from __future__ import annotations
import re

from feature.base_feature import ZefoyTiktokBotBaseFeature


# Pagination support for list operations. On the way out (PreRequest) it
# stamps page/limit (or a cursor) into the request query; on the way back
# (PreResult) it reads the server's pagination signals — a `Link:
# rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
# `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records
# them on `ctx.result.paging`. A per-call cursor/page supplied via ctrl
# paging takes priority (used by auto-iteration). Parameter names
# (`pageParam`/`limitParam`/`cursorParam`), `startPage` and page size
# (`limit`) are configurable.
class ZefoyTiktokBotPagingFeature(ZefoyTiktokBotBaseFeature):
    def __init__(self):
        super().__init__()
        self.version = "0.0.1"
        self.name = "paging"
        self.active = True
        self.client = None
        self.options = {}

    def init(self, ctx, options):
        self.client = ctx.client
        self.options = options if isinstance(options, dict) else {}

        if self.options.get("active") is True:
            self.active = True
        else:
            self.active = False

    def PreRequest(self, ctx):
        if not self.active:
            return
        if not self._is_list(ctx):
            return
        spec = ctx.spec
        if spec is None:
            return
        if spec.query is None:
            spec.query = {}

        page_param = self.options.get("pageParam") or "page"
        limit_param = self.options.get("limitParam") or "limit"
        cursor_param = self.options.get("cursorParam") or "cursor"

        # A per-call cursor/page from ctrl takes priority (auto-iteration).
        paging = getattr(ctx.ctrl, "paging", None) if ctx.ctrl is not None else None
        if not isinstance(paging, dict):
            paging = {}

        if paging.get("cursor") is not None:
            spec.query[cursor_param] = paging["cursor"]
        elif spec.query.get(page_param) is None:
            page = paging.get("page")
            if page is None:
                page = self.options.get("startPage") or 1
            spec.query[page_param] = page

        if self.options.get("limit") is not None and spec.query.get(limit_param) is None:
            spec.query[limit_param] = self.options.get("limit")

    def PreResult(self, ctx):
        if not self.active:
            return
        if not self._is_list(ctx):
            return
        result = ctx.result
        if result is None:
            return

        headers = result.headers or {}
        body = result.body

        paging = {
            "page": self._num(self._header(headers, "x-page")),
            "totalCount": self._num(self._header(headers, "x-total-count")),
            "nextPage": self._num(self._header(headers, "x-next-page")),
            "next": None,
            "cursor": None,
            "hasMore": False,
        }

        # Link: <...>; rel="next"
        link = self._header(headers, "link")
        if link is not None:
            m = re.search(r'<([^>]+)>\s*;\s*rel="?next"?', str(link), re.IGNORECASE)
            if m:
                paging["next"] = m.group(1)

        # Body-level cursors.
        if isinstance(body, dict):
            if body.get("next") is not None:
                paging["next"] = paging["next"] or body["next"]
            if body.get("cursor") is not None:
                paging["cursor"] = body["cursor"]
            if body.get("nextCursor") is not None:
                paging["cursor"] = body["nextCursor"]
            if isinstance(body.get("hasMore"), bool):
                paging["hasMore"] = body["hasMore"]

        paging["hasMore"] = (paging["hasMore"]
                             or paging["next"] is not None
                             or paging["cursor"] is not None
                             or paging["nextPage"] is not None)

        result.paging = paging

        self.client._paging = {"last": paging}

    def _is_list(self, ctx):
        ops = self.options.get("ops") or ["list"]
        opname = ctx.op.name if ctx.op is not None else None
        return opname in ops

    def _header(self, headers, name):
        lower = name.lower()
        for key in headers:
            if str(key).lower() == lower:
                return headers[key]
        return None

    def _num(self, val):
        if val is None:
            return None
        try:
            n = float(val)
        except (TypeError, ValueError):
            return None
        return int(n) if n.is_integer() else n
