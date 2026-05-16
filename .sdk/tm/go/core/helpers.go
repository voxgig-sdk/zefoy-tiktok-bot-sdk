package core

import "fmt"

// UnsupportedOp is returned by entity stub methods for operations the
// underlying API spec doesn't define. The static ZefoyTiktokBotEntity interface
// requires every CRUD method on every entity, so absent ops must still be
// callable — they error at runtime instead of failing to compile.
func UnsupportedOp(opname, entityname string) (any, error) {
	return nil, fmt.Errorf("operation '%s' not supported by entity '%s'", opname, entityname)
}

func ToMapAny(v any) map[string]any {
	if v == nil {
		return nil
	}
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return nil
}

func ToInt(v any) int {
	switch n := v.(type) {
	case int:
		return n
	case float64:
		return int(n)
	case float32:
		return int(n)
	case int64:
		return int(n)
	default:
		return -1
	}
}

func getCtxProp(m map[string]any, key string) any {
	if m == nil {
		return nil
	}
	return m[key]
}
