package feature

import (
	"GOMODULE/core"
)

type BaseFeature struct {
	Version string
	Name    string
	Active  bool
}

func NewBaseFeature() *BaseFeature {
	return &BaseFeature{
		Version: "0.0.1",
		Name:    "base",
		Active:  true,
	}
}

func (f *BaseFeature) GetVersion() string { return f.Version }
func (f *BaseFeature) GetName() string    { return f.Name }
func (f *BaseFeature) GetActive() bool    { return f.Active }

func (f *BaseFeature) Init(ctx *core.Context, options map[string]any)  {}
func (f *BaseFeature) PostConstruct(ctx *core.Context)                 {}
func (f *BaseFeature) PostConstructEntity(ctx *core.Context)           {}
func (f *BaseFeature) SetData(ctx *core.Context)                       {}
func (f *BaseFeature) GetData(ctx *core.Context)                       {}
func (f *BaseFeature) GetMatch(ctx *core.Context)                      {}
func (f *BaseFeature) SetMatch(ctx *core.Context)                      {}
func (f *BaseFeature) PrePoint(ctx *core.Context)                      {}
func (f *BaseFeature) PreSpec(ctx *core.Context)                       {}
func (f *BaseFeature) PreRequest(ctx *core.Context)                    {}
func (f *BaseFeature) PreResponse(ctx *core.Context)                   {}
func (f *BaseFeature) PreResult(ctx *core.Context)                     {}
func (f *BaseFeature) PreDone(ctx *core.Context)                       {}
func (f *BaseFeature) PreUnexpected(ctx *core.Context)                 {}
