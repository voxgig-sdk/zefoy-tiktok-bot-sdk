package feature

import (
	"GOMODULE/core"
)

// Client-side role/permission enforcement. Before an operation resolves its
// endpoint, the required permission for that entity+operation is checked
// against the permissions the client holds; a disallowed call is
// short-circuited with an `rbac_denied` error (via ctx.Out["point"], which
// MakePoint surfaces) and never touches the network. Required permissions
// come from `rules` (keyed by `<entity>.<op>`, `<op>`, or `*`); the default
// when no rule matches is controlled by `deny` (default: allow when
// unspecified). Held permissions are the `permissions` list (a `*` grants
// everything).
type RbacFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	granted map[string]bool

	// Activity tracking (mirrors the ts client._rbac record).
	Allowed int
	Denied  int
	Last    map[string]any
}

func NewRbacFeature() *RbacFeature {
	return &RbacFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "rbac",
			Active:  true,
		},
	}
}

func (f *RbacFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)

	f.granted = map[string]bool{}
	for _, p := range foptStrList(f.options, "permissions") {
		f.granted[p] = true
	}
}

func (f *RbacFeature) PrePoint(ctx *core.Context) {
	if !f.Active {
		return
	}

	required, has := f.required(ctx)
	if !has {
		// No rule: honour the default policy.
		if foptBool(f.options, "deny", false) {
			f.reject(ctx, "<default-deny>")
		}
		return
	}

	if f.granted["*"] || f.granted[required] {
		f.track(ctx, required, true)
		return
	}

	f.reject(ctx, required)
}

func (f *RbacFeature) required(ctx *core.Context) (string, bool) {
	rules := foptMap(f.options, "rules")
	if rules == nil {
		return "", false
	}

	entity := ""
	if ctx.Entity != nil {
		entity = ctx.Entity.GetName()
	} else if ctx.Op != nil {
		entity = ctx.Op.Entity
	}
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}

	for _, key := range []string{entity + "." + opname, opname, "*"} {
		if r, ok := rules[key].(string); ok {
			return r, true
		}
	}
	return "", false
}

func (f *RbacFeature) reject(ctx *core.Context, required string) {
	f.track(ctx, required, false)

	opname := "?"
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	err := ctx.MakeError("rbac_denied",
		"Permission \""+required+"\" required for operation \""+opname+"\"")

	// Short-circuit endpoint resolution; MakePoint surfaces this error
	// before any network activity.
	ctx.Out["point"] = err
}

func (f *RbacFeature) track(ctx *core.Context, required string, allowed bool) {
	if allowed {
		f.Allowed++
	} else {
		f.Denied++
	}
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	f.Last = map[string]any{
		"required": required,
		"allowed":  allowed,
		"op":       opname,
	}
}
