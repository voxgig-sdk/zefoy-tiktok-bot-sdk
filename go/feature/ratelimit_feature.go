package feature

import (
	"math"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

// Client-side rate limiting via a token bucket. Each request consumes a
// token; when the bucket is empty the request waits until the bucket
// refills at `rate` tokens per second (with capacity `burst`, default:
// rate). This keeps the client under a server's published quota rather
// than discovering it via 429s. The clock (`now`) and the wait (`sleep`)
// are injectable so the accounting can be tested deterministically.
type RatelimitFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	tokens  float64
	last    int64

	// Activity tracking (mirrors the ts client._ratelimit record).
	Throttled int
	WaitMs    int
}

func NewRatelimitFeature() *RatelimitFeature {
	return &RatelimitFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "ratelimit",
			Active:  true,
		},
	}
}

func (f *RatelimitFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	if !f.Active {
		return
	}

	rate := foptNum(f.options, "rate", 5)
	burst := foptNum(f.options, "burst", rate)
	f.tokens = burst
	f.last = foptNow(f.options)()

	inner := ctx.Utility.Fetcher

	ctx.Utility.Fetcher = func(ctx2 *core.Context, url string, fetchdef map[string]any) (any, error) {
		f.acquire()
		return inner(ctx2, url, fetchdef)
	}
}

func (f *RatelimitFeature) acquire() {
	rate := foptNum(f.options, "rate", 5)
	burst := foptNum(f.options, "burst", rate)

	// Refill according to elapsed time.
	now := foptNow(f.options)()
	elapsed := now - f.last
	f.last = now
	f.tokens = math.Min(burst, f.tokens+(float64(elapsed)/1000)*rate)

	if f.tokens >= 1 {
		f.tokens -= 1
		return
	}

	// Not enough tokens: wait for one to accrue, then consume it.
	needed := 1 - f.tokens
	waitMs := int(math.Ceil((needed / rate) * 1000))
	f.track(waitMs)
	if waitMs > 0 {
		foptSleep(f.options)(waitMs)
	}
	f.last = foptNow(f.options)()
	f.tokens = 0
}

func (f *RatelimitFeature) track(waitMs int) {
	f.Throttled++
	f.WaitMs += waitMs
}
