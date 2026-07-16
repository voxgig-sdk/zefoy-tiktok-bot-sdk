package feature

import (
	"GOMODULE/core"
)

// Streaming result support. For list-style operations it attaches a
// `Result.Stream` function yielding a channel so callers can consume items
// incrementally with `for item := range result.Stream()` instead of
// materialising the whole slice at once. A `chunkSize` groups items into
// []any batches when set; a `chunkDelay` (ms) paces delivery via the
// injectable `sleep` for offline tests. The channel is fully buffered, so
// abandoning a stream never leaks the producing goroutine.
type StreamingFeature struct {
	BaseFeature
	client  *core.ZefoyTiktokBotSDK
	options map[string]any

	// Activity tracking (mirrors the ts client._streaming record).
	Opened int
}

func NewStreamingFeature() *StreamingFeature {
	return &StreamingFeature{
		BaseFeature: BaseFeature{
			Version: "0.0.1",
			Name:    "streaming",
			Active:  true,
		},
	}
}

func (f *StreamingFeature) Init(ctx *core.Context, options map[string]any) {
	f.client = ctx.Client
	f.options = options
	f.Active = foptBool(options, "active", false)
}

func (f *StreamingFeature) PreResult(ctx *core.Context) {
	if !f.Active || !f.streamable(ctx) {
		return
	}
	result := ctx.Result
	if result == nil {
		return
	}

	result.Streaming = true
	result.Stream = func() <-chan any {
		return f.iterate(result)
	}

	f.Opened++
}

func (f *StreamingFeature) iterate(result *core.Result) <-chan any {
	chunkDelay := foptInt(f.options, "chunkDelay", 0)
	chunkSize := foptInt(f.options, "chunkSize", 0)
	sleep := foptSleep(f.options)

	// Read lazily at Stream() call time so downstream result processing
	// is reflected.
	var items []any
	if list, ok := result.Resdata.([]any); ok {
		items = list
	}

	count := len(items)
	if chunkSize > 0 {
		count = (len(items) + chunkSize - 1) / chunkSize
	}

	// Fully buffered: the producer never blocks on an abandoned consumer.
	out := make(chan any, count)

	go func() {
		defer close(out)

		if chunkSize > 0 {
			for i := 0; i < len(items); i += chunkSize {
				if chunkDelay > 0 {
					sleep(chunkDelay)
				}
				end := i + chunkSize
				if end > len(items) {
					end = len(items)
				}
				out <- items[i:end]
			}
			return
		}

		for _, item := range items {
			if chunkDelay > 0 {
				sleep(chunkDelay)
			}
			out <- item
		}
	}()

	return out
}

func (f *StreamingFeature) streamable(ctx *core.Context) bool {
	opname := ""
	if ctx.Op != nil {
		opname = ctx.Op.Name
	}
	ops := foptStrList(f.options, "ops")
	if ops == nil {
		ops = []string{"list"}
	}
	for _, o := range ops {
		if o == opname {
			return true
		}
	}
	return false
}
