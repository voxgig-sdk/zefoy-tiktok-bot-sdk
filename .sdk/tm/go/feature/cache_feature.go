package feature

import (
	"strings"

	"GOMODULE/core"
)

// Response caching for safe (read) requests. Wraps the active transport and
// serves a fresh cached snapshot instead of hitting the network when the
// same method+URL was fetched within `ttl` ms (default: 5000). Only
// successful (2xx) responses to cacheable methods (default: GET) are
// stored, keyed by method+URL. The cache is bounded (`max` entries, default
// 256, oldest evicted first) and every hit/miss/bypass is counted. Bodies
// are snapshotted on capture so both the current caller and later hits can
// re-read the JSON body repeatedly.
type CacheFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	store   map[string]*cacheEntry
	order   []string

	// Activity tracking (mirrors the ts client._cache record).
	Hit    int
	Miss   int
	Bypass int
}

type cacheEntry struct {
	expiry   int64
	snapshot *cacheSnapshot
}

type cacheSnapshot struct {
	status     int
	statusText string
	data       any
	headers    map[string]any
}

func NewCacheFeature() *CacheFeature {
	return &CacheFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "cache",
			Active:  true,
		},
	}
}

func (f *CacheFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	f.store = map[string]*cacheEntry{}
	f.order = []string{}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		return f.through(ctx2, url, fetchdef, inner)
	}
}

func (f *CacheFeature) through(ctx *core.Context, url string, fetchdef map[string]any,
	inner core.FetcherFunc) (any, error) {

	method := "GET"
	if m, ok := fetchdef["method"].(string); ok && m != "" {
		method = strings.ToUpper(m)
	}

	methods := foptStrList(f.options, "methods")
	if methods == nil {
		methods = []string{"GET"}
	}
	cacheable := false
	for _, m := range methods {
		if strings.ToUpper(m) == method {
			cacheable = true
			break
		}
	}
	if !cacheable {
		return inner(ctx, url, fetchdef)
	}

	key := method + " " + url
	now := foptNow(f.options)()

	if hit, ok := f.store[key]; ok && hit.expiry > now {
		f.Hit++
		return f.replay(hit.snapshot), nil
	}

	res, err := inner(ctx, url, fetchdef)

	if err == nil && f.storable(res) {
		snapshot := f.snapshot(res)
		ttl := foptInt(f.options, "ttl", 5000)
		f.evict()
		f.store[key] = &cacheEntry{expiry: now + int64(ttl), snapshot: snapshot}
		f.order = append(f.order, key)
		f.Miss++
		return f.replay(snapshot), nil
	}

	f.Bypass++
	return res, err
}

func (f *CacheFeature) storable(res any) bool {
	status, ok := fresStatus(res)
	return ok && status >= 200 && status < 300
}

func (f *CacheFeature) snapshot(res any) *cacheSnapshot {
	rm, _ := res.(map[string]any)

	snap := &cacheSnapshot{headers: map[string]any{}}

	if status, ok := fresStatus(res); ok {
		snap.status = status
	}
	if st, ok := rm["statusText"].(string); ok {
		snap.statusText = st
	}
	if jf, ok := rm["json"].(func() any); ok {
		snap.data = jf()
	}
	if headers, ok := rm["headers"].(map[string]any); ok {
		for k, v := range headers {
			snap.headers[strings.ToLower(k)] = v
		}
	}

	return snap
}

// replay builds a fresh transport-shaped response so the body stays
// re-readable for every consumer.
func (f *CacheFeature) replay(snap *cacheSnapshot) map[string]any {
	data := snap.data
	headers := map[string]any{}
	for k, v := range snap.headers {
		headers[k] = v
	}
	return map[string]any{
		"status":     snap.status,
		"statusText": snap.statusText,
		"body":       "not-used",
		"json":       (func() any)(func() any { return data }),
		"headers":    headers,
	}
}

// evict drops oldest entries (FIFO) until the store is under `max`.
func (f *CacheFeature) evict() {
	max := foptInt(f.options, "max", 256)
	for len(f.store) >= max && len(f.order) > 0 {
		oldest := f.order[0]
		f.order = f.order[1:]
		delete(f.store, oldest)
	}
}
