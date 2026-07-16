package feature

import (
	"fmt"
	"math/rand"

	"GOMODULE/core"
)

// Client tracking. Establishes a stable per-client session id at
// construction and stamps identifying headers on every request: a
// `User-Agent` (`<clientName>/<clientVersion>`), an `X-Client-Id` (session),
// and a fresh per-request `X-Request-Id`. This lets a server correlate all
// traffic from one SDK instance and each individual call. Header names,
// client name/version and the id generator (`idgen`) are configurable;
// caller-provided User-Agent / X-Client-Id values are never clobbered.
type ClienttrackFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._clienttrack record).
	Session       string
	Requests      int
	LastRequestID string
	ClientName    string
}

func NewClienttrackFeature() *ClienttrackFeature {
	return &ClienttrackFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "clienttrack",
			Active:  true,
		},
	}
}

func (f *ClienttrackFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
	f.Requests = 0
}

func (f *ClienttrackFeature) PostConstruct(ctx *core.Context) {
	if !f.Active {
		return
	}
	f.Session = foptStr(f.options, "sessionId", f.genid("session"))
	f.ClientName = f.name()
}

func (f *ClienttrackFeature) PreRequest(ctx *core.Context) {
	if !f.Active {
		return
	}

	spec := ctx.Spec
	if spec == nil {
		return
	}
	if spec.Headers == nil {
		spec.Headers = map[string]any{}
	}

	// Lazily establish the session when PostConstruct never fired.
	if f.Session == "" {
		f.Session = foptStr(f.options, "sessionId", f.genid("session"))
	}

	h := foptMap(f.options, "headers")
	f.Requests++
	requestId := f.genid("request")

	fheaderSetDefault(spec.Headers, foptStr(h, "agent", "User-Agent"), f.name())
	fheaderSetDefault(spec.Headers, foptStr(h, "client", "X-Client-Id"), f.Session)
	spec.Headers[foptStr(h, "request", "X-Request-Id")] = requestId

	f.LastRequestID = requestId
	f.ClientName = f.name()
}

func (f *ClienttrackFeature) name() string {
	name := foptStr(f.options, "clientName", "ZefoyTiktokBot-SDK")
	version := foptStr(f.options, "clientVersion", "0.0.1")
	return name + "/" + version
}

func (f *ClienttrackFeature) genid(kind string) string {
	if idgen, ok := f.options["idgen"].(func(string) string); ok {
		return idgen(kind)
	}
	id := fmt.Sprintf("%s-%06x%06x%06x", kind[:1],
		rand.Intn(0x1000000), rand.Intn(0x1000000), rand.Intn(0x1000000))
	if len(id) > 20 {
		id = id[:20]
	}
	return id
}
