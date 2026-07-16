package feature

import (
	"fmt"
	"math/rand"
	"strings"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

// Idempotency keys for mutating operations. Adds an `Idempotency-Key`
// header (name configurable via `header`) to unsafe requests so a server
// can de-duplicate retried writes. The key is set once, at PreRequest,
// before the request is built — so it is stable across transport-level
// retries of the same call. A caller-supplied header is never overwritten
// (case-insensitive). The key generator is injectable (`keygen`).
type IdempotencyFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._idempotency record).
	Issued int
	Last   string
}

func NewIdempotencyFeature() *IdempotencyFeature {
	return &IdempotencyFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "idempotency",
			Active:  true,
		},
	}
}

func (f *IdempotencyFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
}

func (f *IdempotencyFeature) PreRequest(ctx *core.Context) {
	if !f.Active {
		return
	}

	spec := ctx.Spec
	if spec == nil {
		return
	}

	if !f.mutating(ctx) {
		return
	}

	header := foptStr(f.options, "header", "Idempotency-Key")
	if spec.Headers == nil {
		spec.Headers = map[string]any{}
	}

	// Respect a key the caller already provided.
	if _, has := fheaderGet(spec.Headers, header); has {
		return
	}

	key := f.genkey()
	spec.Headers[header] = key

	f.Issued++
	f.Last = key
}

func (f *IdempotencyFeature) mutating(ctx *core.Context) bool {
	methods := foptStrList(f.options, "methods")
	if methods == nil {
		methods = []string{"POST", "PUT", "PATCH", "DELETE"}
	}
	method := ""
	if ctx.Spec != nil {
		method = strings.ToUpper(ctx.Spec.Method)
	}
	if method != "" {
		for _, m := range methods {
			if strings.ToUpper(m) == method {
				return true
			}
		}
	}

	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	ops := foptStrList(f.options, "ops")
	if ops == nil {
		ops = []string{"create", "update", "remove"}
	}
	for _, o := range ops {
		if o == opname {
			return true
		}
	}
	return false
}

func (f *IdempotencyFeature) genkey() string {
	if keygen, ok := f.options["keygen"].(func() string); ok {
		return keygen()
	}
	key := fmt.Sprintf("%06x%06x%06x%06x",
		rand.Intn(0x1000000), rand.Intn(0x1000000),
		rand.Intn(0x1000000), rand.Intn(0x1000000))
	return key[:24]
}
