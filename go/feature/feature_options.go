package feature

import (
	"strconv"
	"strings"
	"time"
)

// Shared option readers for the feature implementations. Feature options
// arrive as map[string]any (from SDK options or test harnesses), so numeric
// values may be int, int64 or float64 and callbacks arrive as typed Go
// funcs. These helpers normalise access and supply defaults, mirroring the
// `null == opts.x ? def : opts.x` pattern of the ts features.

func foptBool(options map[string]any, key string, def bool) bool {
	if options == nil {
		return def
	}
	if b, ok := options[key].(bool); ok {
		return b
	}
	return def
}

func foptInt(options map[string]any, key string, def int) int {
	if options == nil {
		return def
	}
	switch n := options[key].(type) {
	case int:
		return n
	case int64:
		return int(n)
	case float64:
		return int(n)
	case float32:
		return int(n)
	}
	return def
}

func foptNum(options map[string]any, key string, def float64) float64 {
	if options == nil {
		return def
	}
	switch n := options[key].(type) {
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case float64:
		return n
	case float32:
		return float64(n)
	}
	return def
}

func foptStr(options map[string]any, key string, def string) string {
	if options == nil {
		return def
	}
	if s, ok := options[key].(string); ok && s != "" {
		return s
	}
	return def
}

func foptMap(options map[string]any, key string) map[string]any {
	if options == nil {
		return nil
	}
	if m, ok := options[key].(map[string]any); ok {
		return m
	}
	return nil
}

func foptList(options map[string]any, key string) []any {
	if options == nil {
		return nil
	}
	if l, ok := options[key].([]any); ok {
		return l
	}
	return nil
}

// foptStrList reads a list option as strings ([]any or []string).
func foptStrList(options map[string]any, key string) []string {
	if options == nil {
		return nil
	}
	if sl, ok := options[key].([]string); ok {
		return sl
	}
	var out []string
	for _, v := range foptList(options, key) {
		if s, ok := v.(string); ok {
			out = append(out, s)
		}
	}
	return out
}

// foptSleep returns the injectable sleep (option "sleep": func(ms int)),
// defaulting to a real time.Sleep. Injected clocks keep tests deterministic.
func foptSleep(options map[string]any) func(ms int) {
	if options != nil {
		if fn, ok := options["sleep"].(func(int)); ok {
			return fn
		}
	}
	return func(ms int) {
		if ms > 0 {
			time.Sleep(time.Duration(ms) * time.Millisecond)
		}
	}
}

// foptNow returns the injectable clock (option "now": func() int64, ms),
// defaulting to the wall clock.
func foptNow(options map[string]any) func() int64 {
	if options != nil {
		if fn, ok := options["now"].(func() int64); ok {
			return fn
		}
	}
	return func() int64 {
		return time.Now().UnixMilli()
	}
}

// fheaderGet reads a header value case-insensitively.
func fheaderGet(headers map[string]any, name string) (any, bool) {
	if headers == nil {
		return nil, false
	}
	lower := strings.ToLower(name)
	for k, v := range headers {
		if strings.ToLower(k) == lower {
			return v, true
		}
	}
	return nil, false
}

// fheaderSetDefault sets a header only when no case-insensitive variant of
// it exists already (never clobber a caller-provided value).
func fheaderSetDefault(headers map[string]any, name string, value string) {
	if headers == nil {
		return
	}
	if _, has := fheaderGet(headers, name); has {
		return
	}
	headers[name] = value
}

// fresStatus extracts the numeric status from a transport-shaped response
// (map with a "status" entry). Returns ok=false when absent or non-numeric.
func fresStatus(res any) (int, bool) {
	rm, ok := res.(map[string]any)
	if !ok || rm == nil {
		return 0, false
	}
	switch n := rm["status"].(type) {
	case int:
		return n, true
	case int64:
		return int(n), true
	case float64:
		return int(n), true
	}
	return 0, false
}

// fresHeader reads a header from a transport-shaped response,
// case-insensitively, as a string.
func fresHeader(res any, name string) (string, bool) {
	rm, ok := res.(map[string]any)
	if !ok || rm == nil {
		return "", false
	}
	headers, ok := rm["headers"].(map[string]any)
	if !ok {
		return "", false
	}
	v, has := fheaderGet(headers, name)
	if !has {
		return "", false
	}
	s, ok := v.(string)
	return s, ok
}

// fparseInt parses a decimal string; def when unparseable.
func fparseInt(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return def
	}
	return n
}
