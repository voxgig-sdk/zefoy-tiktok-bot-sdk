package utility

import (
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeOptionsUtil(ctx *core.Context) map[string]any {
	options := ctx.Options
	if options == nil {
		options = map[string]any{}
	}

	// Merge custom utility overrides onto the utility object.
	// Read from original options before clone, since vs.Clone strips functions.
	if customUtils := core.ToMapAny(options["utility"]); customUtils != nil {
		utility := ctx.Utility
		if utility != nil {
			for key, val := range customUtils {
				utility.Custom[key] = val
			}
		}
	}

	opts := vs.Clone(options).(map[string]any)

	config := ctx.Config
	if config == nil {
		config = map[string]any{}
	}
	cfgopts := map[string]any{}
	if co, ok := config["options"]; ok && co != nil {
		if cm, ok := co.(map[string]any); ok {
			cfgopts = cm
		}
	}

	optspec := map[string]any{
		"apikey": "",
		"base":   "http://localhost:8000",
		"prefix": "",
		"suffix": "",
		"auth": map[string]any{
			"prefix": "",
		},
		"headers": map[string]any{
			"`$CHILD`": "`$STRING`",
		},
		"allow": map[string]any{
			"method": "GET,PUT,POST,PATCH,DELETE,OPTIONS",
			"op":     "create,update,load,list,remove,command,direct",
		},
		"entity": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
				"alias":   map[string]any{},
			},
		},
		"feature": map[string]any{
			"`$CHILD`": map[string]any{
				"`$OPEN`": true,
				"active":  false,
			},
		},
		"utility": map[string]any{},
		"system":  map[string]any{},
		"test": map[string]any{
			"active": false,
			"entity": map[string]any{
				"`$OPEN`": true,
			},
		},
		"clean": map[string]any{
			"keys": "key,token,id",
		},
	}

	// Preserve system.fetch before merge/validate.
	var sysFetch any
	if sf := vs.GetPath([]any{"system", "fetch"}, opts); sf != nil {
		sysFetch = sf
	}

	merged := vs.Merge([]any{map[string]any{}, cfgopts, opts})
	validated, _ := vs.Validate(merged, optspec)
	opts = validated.(map[string]any)

	// Restore system.fetch.
	if sysFetch != nil {
		if sys, ok := opts["system"]; ok {
			if sm, ok := sys.(map[string]any); ok {
				sm["fetch"] = sysFetch
			}
		} else {
			opts["system"] = map[string]any{"fetch": sysFetch}
		}
	}

	// Derived clean config.
	cleanKeys := "key,token,id"
	if ck := vs.GetPath([]any{"clean", "keys"}, opts); ck != nil {
		if cks, ok := ck.(string); ok {
			cleanKeys = cks
		}
	}

	parts := strings.Split(cleanKeys, ",")
	var filtered []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			filtered = append(filtered, vs.EscRe(p))
		}
	}
	keyre := strings.Join(filtered, "|")

	derived := map[string]any{
		"clean": map[string]any{},
	}
	if keyre != "" {
		derived["clean"] = map[string]any{"keyre": keyre}
	}
	opts["__derived__"] = derived

	return opts
}
