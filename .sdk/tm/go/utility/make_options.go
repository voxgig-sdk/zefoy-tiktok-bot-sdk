package utility

import (
	"sort"
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

	// Feature add-order (feature #2). options.feature may be given as an ordered
	// ARRAY of {name, active, ...opts} entries (the array position IS the order
	// in which features are added), or as a {name:{opts}} map. Normalize an
	// array to a map (so merge/validate/init are unchanged) and remember the
	// explicit order; a map defaults to test-first so the `test` mock transport
	// is installed as the base of the transport wrapper chain.
	var featureorder []any
	if farr, ok := opts["feature"].([]any); ok {
		fmap := map[string]any{}
		for _, entry := range farr {
			em := core.ToMapAny(entry)
			if em == nil {
				continue
			}
			name, _ := em["name"].(string)
			if name == "" {
				continue
			}
			fopts := map[string]any{}
			for k, v := range em {
				if k != "name" {
					fopts[k] = v
				}
			}
			fmap[name] = fopts
			featureorder = append(featureorder, name)
		}
		opts["feature"] = fmap
	}

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

	// Resolve the feature add-order: an explicit array order (above) wins;
	// otherwise order the map test-first, then the remaining names sorted, so
	// the outcome is deterministic and `test` is always the base transport.
	if len(featureorder) == 0 {
		fmap := core.ToMapAny(opts["feature"])
		names := make([]string, 0, len(fmap))
		for k := range fmap {
			names = append(names, k)
		}
		sort.Strings(names)
		hasTest := false
		for _, n := range names {
			if n == "test" {
				hasTest = true
			}
		}
		if hasTest {
			featureorder = append(featureorder, "test")
			for _, n := range names {
				if n != "test" {
					featureorder = append(featureorder, n)
				}
			}
		} else {
			for _, n := range names {
				featureorder = append(featureorder, n)
			}
		}
	}

	derived := map[string]any{
		"clean": map[string]any{},
	}
	if keyre != "" {
		derived["clean"] = map[string]any{"keyre": keyre}
	}
	derived["featureorder"] = featureorder
	opts["__derived__"] = derived

	return opts
}
