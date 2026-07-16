package feature

import (
	"regexp"

	"GOMODULE/core"
)

// Pagination support for list operations. On the way out (PreRequest) it
// stamps page/limit (or a cursor) into the request query; on the way back
// (PreResult) it reads the server's pagination signals — a `Link:
// rel="next"` header, `X-Page`/`X-Next-Page`/`X-Total-Count` headers, or
// `next`/`cursor`/`nextCursor`/`hasMore` fields in the body — and records
// them on `ctx.Result.Paging`. A per-call cursor/page from ctrl takes
// priority (used by auto-iteration). Parameter names (`pageParam`,
// `limitParam`, `cursorParam`), the page size (`limit`) and the start page
// (`startPage`, default 1) are configurable.
type PagingFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._paging record).
	Last map[string]any
}

var pagingLinkNextRe = regexp.MustCompile(`(?i)<([^>]+)>\s*;\s*rel="?next"?`)

func NewPagingFeature() *PagingFeature {
	return &PagingFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "paging",
			Active:  true,
		},
	}
}

func (f *PagingFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
}

func (f *PagingFeature) PreRequest(ctx *core.Context) {
	if !f.Active || !f.isList(ctx) {
		return
	}
	spec := ctx.Spec
	if spec == nil {
		return
	}
	if spec.Query == nil {
		spec.Query = map[string]any{}
	}

	pageParam := foptStr(f.options, "pageParam", "page")
	limitParam := foptStr(f.options, "limitParam", "limit")
	cursorParam := foptStr(f.options, "cursorParam", "cursor")

	// A per-call cursor/page from ctrl takes priority (auto-iteration).
	var paging map[string]any
	if ctx.Ctrl != nil {
		paging = ctx.Ctrl.Paging
	}

	if cursor, has := paging["cursor"]; has && cursor != nil {
		spec.Query[cursorParam] = cursor
	} else if spec.Query[pageParam] == nil {
		if page, has := paging["page"]; has && page != nil {
			spec.Query[pageParam] = page
		} else {
			spec.Query[pageParam] = foptInt(f.options, "startPage", 1)
		}
	}

	if f.options["limit"] != nil && spec.Query[limitParam] == nil {
		spec.Query[limitParam] = foptInt(f.options, "limit", 0)
	}
}

func (f *PagingFeature) PreResult(ctx *core.Context) {
	if !f.Active || !f.isList(ctx) {
		return
	}
	result := ctx.Result
	if result == nil {
		return
	}

	headers := result.Headers
	body := result.Body

	paging := map[string]any{
		"hasMore": false,
	}
	f.headerNum(headers, "x-page", paging, "page")
	f.headerNum(headers, "x-total-count", paging, "totalCount")
	f.headerNum(headers, "x-next-page", paging, "nextPage")

	// Link: <...>; rel="next"
	if link, has := fheaderGet(headers, "link"); has {
		if ls, ok := link.(string); ok {
			if m := pagingLinkNextRe.FindStringSubmatch(ls); m != nil {
				paging["next"] = m[1]
			}
		}
	}

	// Body-level cursors.
	if bm, ok := body.(map[string]any); ok {
		if bm["next"] != nil && paging["next"] == nil {
			paging["next"] = bm["next"]
		}
		if bm["cursor"] != nil {
			paging["cursor"] = bm["cursor"]
		}
		if bm["nextCursor"] != nil {
			paging["cursor"] = bm["nextCursor"]
		}
		if hasMore, ok := bm["hasMore"].(bool); ok {
			paging["hasMore"] = hasMore
		}
	}

	if paging["hasMore"] != true &&
		(paging["next"] != nil || paging["cursor"] != nil || paging["nextPage"] != nil) {
		paging["hasMore"] = true
	}

	result.Paging = paging
	f.Last = paging
}

func (f *PagingFeature) isList(ctx *core.Context) bool {
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	ops := foptStrList(f.options, "ops")
	if ops == nil {
		ops = []string{"list"}
	}
	for _, o := range ops {
		if o == opname {
			return true
		}
	}
	return false
}

func (f *PagingFeature) headerNum(headers map[string]any, name string,
	paging map[string]any, key string) {

	v, has := fheaderGet(headers, name)
	if !has {
		return
	}
	if s, ok := v.(string); ok {
		if n := fparseInt(s, -1); n >= 0 {
			paging[key] = n
		}
		return
	}
	switch n := v.(type) {
	case int:
		paging[key] = n
	case int64:
		paging[key] = int(n)
	case float64:
		paging[key] = int(n)
	}
}
