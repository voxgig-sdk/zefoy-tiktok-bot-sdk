package core

type Control struct {
	Throw   *bool
	Err     error
	Explain map[string]any
	Actor   string
	Paging  map[string]any
}
