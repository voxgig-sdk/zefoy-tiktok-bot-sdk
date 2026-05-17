package core

import (
	"math/rand"
	"strconv"

	vs "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/utility/struct"
)

type Context struct {
	Id       string
	Out      map[string]any
	Ctrl     *Control
	Meta     map[string]any
	Client   *ZefoyTiktokBotSDK
	Utility  *Utility
	Op       *Operation
	Point    map[string]any
	Config   map[string]any
	Entopts  map[string]any
	Options  map[string]any
	Opmap    map[string]*Operation
	Response *Response
	Result   *Result
	Spec     *Spec
	Data     map[string]any
	Reqdata  map[string]any
	Match    map[string]any
	Reqmatch map[string]any
	Entity   Entity
	Shared   map[string]any
}

func NewContext(ctxmap map[string]any, basectx *Context) *Context {
	ctx := &Context{
		Id:  "C" + strconv.Itoa(rand.Intn(90000000)+10000000),
		Out: map[string]any{},
	}

	// Client
	if c := getCtxProp(ctxmap, "client"); c != nil {
		if sdk, ok := c.(*ZefoyTiktokBotSDK); ok {
			ctx.Client = sdk
		}
	}
	if ctx.Client == nil && basectx != nil {
		ctx.Client = basectx.Client
	}

	// Utility
	if u := getCtxProp(ctxmap, "utility"); u != nil {
		if util, ok := u.(*Utility); ok {
			ctx.Utility = util
		}
	}
	if ctx.Utility == nil && basectx != nil {
		ctx.Utility = basectx.Utility
	}

	// Ctrl
	ctx.Ctrl = &Control{}
	if c := getCtxProp(ctxmap, "ctrl"); c != nil {
		if cm, ok := c.(map[string]any); ok {
			if t, ok := cm["throw"]; ok {
				if b, ok := t.(bool); ok {
					ctx.Ctrl.Throw = &b
				}
			}
			if e, ok := cm["explain"]; ok {
				if em, ok := e.(map[string]any); ok {
					ctx.Ctrl.Explain = em
				}
			}
		} else if ctrl, ok := c.(*Control); ok {
			ctx.Ctrl = ctrl
		}
	} else if basectx != nil && basectx.Ctrl != nil {
		ctx.Ctrl = basectx.Ctrl
	}

	// Meta
	ctx.Meta = map[string]any{}
	if m := getCtxProp(ctxmap, "meta"); m != nil {
		if mm, ok := m.(map[string]any); ok {
			ctx.Meta = mm
		}
	} else if basectx != nil && basectx.Meta != nil {
		ctx.Meta = basectx.Meta
	}

	// Config
	if c := getCtxProp(ctxmap, "config"); c != nil {
		if cm, ok := c.(map[string]any); ok {
			ctx.Config = cm
		}
	}
	if ctx.Config == nil && basectx != nil {
		ctx.Config = basectx.Config
	}

	// Entopts
	if e := getCtxProp(ctxmap, "entopts"); e != nil {
		if em, ok := e.(map[string]any); ok {
			ctx.Entopts = em
		}
	}
	if ctx.Entopts == nil && basectx != nil {
		ctx.Entopts = basectx.Entopts
	}

	// Options
	if o := getCtxProp(ctxmap, "options"); o != nil {
		if om, ok := o.(map[string]any); ok {
			ctx.Options = om
		}
	}
	if ctx.Options == nil && basectx != nil {
		ctx.Options = basectx.Options
	}

	// Entity
	if e := getCtxProp(ctxmap, "entity"); e != nil {
		if ent, ok := e.(Entity); ok {
			ctx.Entity = ent
		}
	}
	if ctx.Entity == nil && basectx != nil {
		ctx.Entity = basectx.Entity
	}

	// Shared
	if s := getCtxProp(ctxmap, "shared"); s != nil {
		if sm, ok := s.(map[string]any); ok {
			ctx.Shared = sm
		}
	}
	if ctx.Shared == nil && basectx != nil {
		ctx.Shared = basectx.Shared
	}

	// Opmap
	if o := getCtxProp(ctxmap, "opmap"); o != nil {
		if om, ok := o.(map[string]*Operation); ok {
			ctx.Opmap = om
		}
	}
	if ctx.Opmap == nil && basectx != nil {
		ctx.Opmap = basectx.Opmap
	}
	if ctx.Opmap == nil {
		ctx.Opmap = map[string]*Operation{}
	}

	// Data
	ctx.Data = ToMapAny(getCtxProp(ctxmap, "data"))
	if ctx.Data == nil {
		ctx.Data = map[string]any{}
	}
	ctx.Reqdata = ToMapAny(getCtxProp(ctxmap, "reqdata"))
	if ctx.Reqdata == nil {
		ctx.Reqdata = map[string]any{}
	}
	ctx.Match = ToMapAny(getCtxProp(ctxmap, "match"))
	if ctx.Match == nil {
		ctx.Match = map[string]any{}
	}
	ctx.Reqmatch = ToMapAny(getCtxProp(ctxmap, "reqmatch"))
	if ctx.Reqmatch == nil {
		ctx.Reqmatch = map[string]any{}
	}

	// Point
	if t := getCtxProp(ctxmap, "point"); t != nil {
		if tm, ok := t.(map[string]any); ok {
			ctx.Point = tm
		}
	}
	if ctx.Point == nil && basectx != nil {
		ctx.Point = basectx.Point
	}

	// Spec
	if s := getCtxProp(ctxmap, "spec"); s != nil {
		if sp, ok := s.(*Spec); ok {
			ctx.Spec = sp
		}
	}
	if ctx.Spec == nil && basectx != nil {
		ctx.Spec = basectx.Spec
	}

	// Result
	if r := getCtxProp(ctxmap, "result"); r != nil {
		if res, ok := r.(*Result); ok {
			ctx.Result = res
		}
	}
	if ctx.Result == nil && basectx != nil {
		ctx.Result = basectx.Result
	}

	// Response
	if r := getCtxProp(ctxmap, "response"); r != nil {
		if resp, ok := r.(*Response); ok {
			ctx.Response = resp
		}
	}
	if ctx.Response == nil && basectx != nil {
		ctx.Response = basectx.Response
	}

	// Resolve operation
	opname, _ := getCtxProp(ctxmap, "opname").(string)
	ctx.Op = ctx.resolveOp(opname)

	return ctx
}

func (ctx *Context) resolveOp(opname string) *Operation {
	// Cache key is `<entity>:<opname>` so two entities with the same op
	// (e.g. both have a "list") get distinct cached Operations. Keying on
	// opname alone caused the first-resolved entity's points to be served
	// to every subsequent entity's call.
	entname := ""
	if ctx.Entity != nil {
		entname = ctx.Entity.GetName()
	}
	cacheKey := entname + ":" + opname

	if op, ok := ctx.Opmap[cacheKey]; ok && op != nil {
		return op
	}

	if opname == "" {
		return NewOperation(map[string]any{})
	}

	opcfg := vs.GetPath([]any{"entity", entname, "op", opname}, ctx.Config)

	input := "match"
	if opname == "update" || opname == "create" {
		input = "data"
	}

	var targets []any
	if opcfg != nil {
		if ocm, ok := opcfg.(map[string]any); ok {
			if t := vs.GetProp(ocm, "points"); t != nil {
				if tl, ok := t.([]any); ok {
					targets = tl
				}
			}
		}
	}
	if targets == nil {
		targets = []any{}
	}

	op := NewOperation(map[string]any{
		"entity":  entname,
		"name":    opname,
		"input":   input,
		"points": targets,
	})

	ctx.Opmap[cacheKey] = op
	return op
}

func (ctx *Context) MakeError(code string, msg string) *ZefoyTiktokBotError {
	return NewZefoyTiktokBotError(code, msg, ctx)
}
