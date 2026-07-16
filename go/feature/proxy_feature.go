package feature

import (
	"os"
	"regexp"
	"strings"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

// Outbound HTTP(S) proxy support. Wraps the active transport and annotates
// each request's fetch definition with the proxy target (`fetchdef.proxy`).
// The default net/http transport honours the annotation by routing the
// request through an http.Transport with Proxy set (see utility/fetcher.go);
// custom transports can do the same. The proxy target comes from options
// (`url`) or, when `fromEnv` is set, the standard HTTPS_PROXY / HTTP_PROXY /
// NO_PROXY environment variables. Hosts matching `noProxy` bypass the proxy.
type ProxyFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	noProxy []string

	// Activity tracking (mirrors the ts client._proxy record).
	Routed int
	Url    string
}

var proxyHostRe = regexp.MustCompile(`(?i)^[a-z]+://([^/:]+)`)

func NewProxyFeature() *ProxyFeature {
	return &ProxyFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "proxy",
			Active:  true,
		},
	}
}

func (f *ProxyFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	f.Url = foptStr(f.options, "url", "")
	noProxy := foptStrList(f.options, "noProxy")

	if foptBool(f.options, "fromEnv", false) {
		if f.Url == "" {
			f.Url = firstEnv("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy")
		}
		if noProxy == nil {
			if np := firstEnv("NO_PROXY", "no_proxy"); np != "" {
				noProxy = strings.Split(np, ",")
			}
		}
	}

	f.noProxy = []string{}
	for _, np := range noProxy {
		np = strings.TrimSpace(np)
		if np != "" {
			f.noProxy = append(f.noProxy, np)
		}
	}

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		fetchdef = f.route(url, fetchdef)
		return inner(ctx2, url, fetchdef)
	}
}

func (f *ProxyFeature) route(url string, fetchdef map[string]any) map[string]any {
	if f.Url == "" || f.bypass(url) {
		return fetchdef
	}

	out := map[string]any{}
	for k, v := range fetchdef {
		out[k] = v
	}
	out["proxy"] = f.Url

	f.Routed++
	return out
}

func (f *ProxyFeature) bypass(url string) bool {
	if len(f.noProxy) == 0 {
		return false
	}
	host := url
	if m := proxyHostRe.FindStringSubmatch(url); m != nil {
		host = m[1]
	}
	for _, np := range f.noProxy {
		if np == "*" {
			return true
		}
		if host == np || strings.HasSuffix(host, "."+strings.TrimPrefix(np, ".")) {
			return true
		}
	}
	return false
}

func firstEnv(names ...string) string {
	for _, name := range names {
		if v := os.Getenv(name); v != "" {
			return v
		}
	}
	return ""
}
