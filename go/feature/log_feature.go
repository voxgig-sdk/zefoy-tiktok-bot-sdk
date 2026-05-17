package feature

import (
	"log/slog"
	"os"

	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"
)

type LogFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any
	logger  *slog.Logger
}

func NewLogFeature() *LogFeature {
	return &LogFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "log",
			Active:  true,
		},
	}
}

func (f *LogFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options

	if active, ok := options["active"].(bool); ok {
		f.Active = active
	}

	if f.Active {
		if logger, ok := options["logger"].(*slog.Logger); ok && logger != nil {
			f.logger = logger
		} else {
			level := slog.LevelInfo
			if lvl, ok := options["level"].(string); ok {
				switch lvl {
				case "debug":
					level = slog.LevelDebug
				case "warn":
					level = slog.LevelWarn
				case "error":
					level = slog.LevelError
				}
			}

			f.logger = slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
				Level: level,
			})).With("name", "log")
		}
	}
}

func (f *LogFeature) PostConstruct(ctx *core.Context) {
	f.loghook("PostConstruct", ctx, "")
}

func (f *LogFeature) PostConstructEntity(ctx *core.Context) {
	f.loghook("PostConstructEntity", ctx, "")
}

func (f *LogFeature) SetData(ctx *core.Context) {
	f.loghook("SetData", ctx, "")
}

func (f *LogFeature) GetData(ctx *core.Context) {
	f.loghook("GetData", ctx, "")
}

func (f *LogFeature) SetMatch(ctx *core.Context) {
	f.loghook("SetMatch", ctx, "")
}

func (f *LogFeature) GetMatch(ctx *core.Context) {
	f.loghook("GetMatch", ctx, "")
}

func (f *LogFeature) PrePoint(ctx *core.Context) {
	f.loghook("PrePoint", ctx, "")
}

func (f *LogFeature) PreSpec(ctx *core.Context) {
	f.loghook("PreSpec", ctx, "")
}

func (f *LogFeature) PreRequest(ctx *core.Context) {
	f.loghook("PreRequest", ctx, "")
}

func (f *LogFeature) PreResponse(ctx *core.Context) {
	f.loghook("PreResponse", ctx, "")
}

func (f *LogFeature) PreResult(ctx *core.Context) {
	f.loghook("PreResult", ctx, "")
}

func (f *LogFeature) loghook(hook string, ctx *core.Context, level string) {
	if f.logger == nil {
		return
	}

	if level == "" {
		level = "info"
	}

	attrs := []any{
		"hook", hook,
	}

	if ctx.Op != nil {
		attrs = append(attrs, "op", ctx.Op.Name)
	}

	if ctx.Spec != nil {
		attrs = append(attrs, "spec", ctx.Spec.Method+" "+ctx.Spec.Path)
	}

	switch level {
	case "debug":
		f.logger.Debug("hook", attrs...)
	case "warn":
		f.logger.Warn("hook", attrs...)
	case "error":
		f.logger.Error("hook", attrs...)
	default:
		f.logger.Info("hook", attrs...)
	}
}
