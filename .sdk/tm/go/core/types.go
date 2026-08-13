package core

type Feature interface {
	GetVersion() string
	GetName() string
	GetActive() bool

	Init(ctx *Context, options map[string]any)

	PostConstruct(ctx *Context)
	PostConstructEntity(ctx *Context)
	SetData(ctx *Context)
	GetData(ctx *Context)
	GetMatch(ctx *Context)

	PrePoint(ctx *Context)
	PreSpec(ctx *Context)
	PreRequest(ctx *Context)
	PreResponse(ctx *Context)
	PreResult(ctx *Context)
	PreDone(ctx *Context)
	PreUnexpected(ctx *Context)
	SetMatch(ctx *Context)
}

type Entity interface {
	GetName() string
	Make() Entity
	Data(data ...any) any
	Match(match ...any) any

	// Every operation resolves to the entity; Remove additionally marks it.
	// The instance keeps the data it held — a caller can still read what was
	// deleted — but it is no longer a live record.
	MarkDeleted()
	Deleted() bool
}

type ZefoyTiktokBotEntity interface {
	Entity
	Load(reqmatch map[string]any, ctrl map[string]any) (any, error)
	List(reqmatch map[string]any, ctrl map[string]any) (any, error)
	Create(reqdata map[string]any, ctrl map[string]any) (any, error)
	Update(reqdata map[string]any, ctrl map[string]any) (any, error)
	Remove(reqmatch map[string]any, ctrl map[string]any) (any, error)
	Stream(action string, args map[string]any, callopts map[string]any) <-chan any
}

type FetcherFunc func(ctx *Context, fullurl string, fetchdef map[string]any) (any, error)
