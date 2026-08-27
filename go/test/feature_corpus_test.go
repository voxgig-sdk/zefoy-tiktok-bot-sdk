package sdktest

// Feature behaviour, driven by the SHARED corpus.
//
// The same route primary_utility_test.go takes for the utilities:
// language-neutral cases in .sdk/test/test.json, executed against THIS
// generated SDK. The feature is the ordinary compiled type, built by the
// generated config, installed by the generated constructor, and driven by a
// real entity operation. Not a miniature of the pipeline - that is what
// feature_harness_test.go does, and a miniature can only be as right as the
// miniature.
//
// Everything in a case is data. The two pieces go writes for itself are
// turning scripted responses into a FetcherFunc, and reading the record back
// off the feature (go keeps the aggregates on the feature value, where ts
// keeps them on the client).

import (
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"testing"

	sdk "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go"
)

// Features with a corpus section. A name here with no section is a skip, not
// a failure: an SDK generated without the feature has nothing to run.
var featureCorpusNames = []string{"cost"}

// The standard operation names, in the order the runner prefers them. Every
// entity declares every CRUD method, so an op that the API does not define
// errors at runtime rather than failing to compile - which is why usable
// operations are found by DRIVING them, below.
var featureCorpusOps = []string{"Load", "List", "Create", "Update", "Remove"}

// One operation this SDK can actually perform.
type fcOp struct {
	key      string // "<entity>.<op>", how features attribute it
	accessor string // the client method returning the entity
	method   string // the op method on that entity
}

// fcFetcher builds a scripted transport from a case's `res` list. Responses
// are consumed in order and the last one repeats, so a case that does not
// care how many attempts happen need only declare one.
func fcFetcher(res []any) sdk.FetcherFunc {
	n := -1
	return func(ctx *sdk.Context, fullurl string, fetchdef map[string]any) (any, error) {
		n++
		var spec map[string]any
		if len(res) > 0 {
			i := n
			if i >= len(res) {
				i = len(res) - 1
			}
			spec, _ = res[i].(map[string]any)
		}
		if spec == nil {
			spec = map[string]any{}
		}

		if thrown, _ := spec["throw"].(bool); thrown {
			return nil, fmt.Errorf("scripted transport failure")
		}

		status := 200
		if s, ok := fcNum(spec["status"]); ok {
			status = int(s)
		}
		statusText := "OK"
		if status >= 400 {
			statusText = "ERR"
		}

		headers := map[string]any{}
		if h, ok := spec["headers"].(map[string]any); ok {
			for k, v := range h {
				headers[k] = v
			}
		}

		body := spec["body"]
		if body == nil {
			body = map[string]any{}
		}

		// The shape the real fetcher returns: the PARSED body comes back
		// through a `json` thunk, and `body` is the raw string. makeResult
		// reads the thunk, so a scripted response that only set `body` would
		// look like an empty result - which reads as a feature defect rather
		// than a mis-shaped script.
		raw, _ := json.Marshal(body)

		return map[string]any{
			"status":     status,
			"statusText": statusText,
			"headers":    headers,
			"json":       (func() any)(func() any { return body }),
			"body":       string(raw),
		}, nil
	}
}

// fcClient builds a client the way a caller would: the generated constructor,
// the feature list from the case, and the scripted transport through the
// documented `utility.fetcher` override.
//
// NewZefoyTiktokBotSDK, not TestSDK: the `test` feature is transport: 'base' and
// REPLACES the transport, so a client in test mode would shadow the script.
func fcClient(kase map[string]any) *sdk.ZefoyTiktokBotSDK {
	res, _ := kase["res"].([]any)
	opts := map[string]any{
		"utility": map[string]any{"fetcher": fcFetcher(res)},
	}
	if f, ok := kase["feature"]; ok {
		opts["feature"] = f
	}
	return sdk.NewZefoyTiktokBotSDK(opts)
}

// fcCandidates lists the operations this SDK declares, in a stable order.
//
// The corpus cannot name an entity - it is shared by SDKs with none in common
// - so the runner finds them here. An entity accessor is a client method
// taking one options map and returning something that answers GetName().
func fcCandidates(client *sdk.ZefoyTiktokBotSDK) []fcOp {
	out := []fcOp{}

	cv := reflect.ValueOf(client)
	ct := cv.Type()
	mapType := reflect.TypeOf(map[string]any{})

	names := []string{}
	byName := map[string]reflect.Value{}

	for i := 0; i < ct.NumMethod(); i++ {
		m := ct.Method(i)
		mt := m.Type
		// (receiver, entopts) -> entity
		if mt.NumIn() != 2 || mt.NumOut() != 1 || mt.In(1) != mapType {
			continue
		}
		ent := cv.Method(i).Call([]reflect.Value{reflect.ValueOf(map[string]any(nil))})[0]
		if !ent.IsValid() || (ent.Kind() == reflect.Ptr && ent.IsNil()) {
			continue
		}
		gn := ent.MethodByName("GetName")
		if !gn.IsValid() || gn.Type().NumIn() != 0 || gn.Type().NumOut() != 1 ||
			gn.Type().Out(0).Kind() != reflect.String {
			continue
		}
		entname := gn.Call(nil)[0].String()
		if entname == "" {
			continue
		}
		names = append(names, entname)
		byName[entname] = ent
		_ = m
	}

	// Sorted, so the choice of operation is stable across runs.
	for i := 0; i < len(names); i++ {
		for j := i + 1; j < len(names); j++ {
			if names[j] < names[i] {
				names[i], names[j] = names[j], names[i]
			}
		}
	}

	for _, entname := range names {
		ent := byName[entname]
		for _, opname := range featureCorpusOps {
			om := ent.MethodByName(opname)
			if !om.IsValid() || om.Type().NumIn() != 2 || om.Type().NumOut() != 2 {
				continue
			}
			out = append(out, fcOp{
				key:      entname + "." + strings.ToLower(opname),
				accessor: entname,
				method:   opname,
			})
		}
	}
	return out
}

// fcInvoke performs one operation on a client, by entity name and method.
func fcInvoke(client *sdk.ZefoyTiktokBotSDK, op fcOp, ctrl map[string]any) error {
	cv := reflect.ValueOf(client)
	ct := cv.Type()
	mapType := reflect.TypeOf(map[string]any{})

	for i := 0; i < ct.NumMethod(); i++ {
		mt := ct.Method(i).Type
		if mt.NumIn() != 2 || mt.NumOut() != 1 || mt.In(1) != mapType {
			continue
		}
		ent := cv.Method(i).Call([]reflect.Value{reflect.ValueOf(map[string]any(nil))})[0]
		gn := ent.MethodByName("GetName")
		if !gn.IsValid() || gn.Type().NumIn() != 0 || gn.Type().NumOut() != 1 ||
			gn.Type().Out(0).Kind() != reflect.String {
			continue
		}
		if gn.Call(nil)[0].String() != op.accessor {
			continue
		}
		om := ent.MethodByName(op.method)
		if !om.IsValid() {
			return fmt.Errorf("no method %s on entity %s", op.method, op.accessor)
		}
		rets := om.Call([]reflect.Value{
			reflect.ValueOf(map[string]any{}),
			reflect.ValueOf(ctrl),
		})
		if err, ok := rets[1].Interface().(error); ok && err != nil {
			return err
		}
		return nil
	}
	return fmt.Errorf("no entity accessor for %s", op.accessor)
}

// fcUsableOps picks operations by DRIVING them: an op is usable when it
// completes against a plain 200 with no feature active. Declared operations
// are not all callable with no arguments (a required path parameter, a body),
// and a case failing for that reason would read as a feature defect.
func fcUsableOps(want int) []fcOp {
	picked := []fcOp{}
	probe := fcClient(map[string]any{})
	for _, cand := range fcCandidates(probe) {
		client := fcClient(map[string]any{})
		if err := fcInvoke(client, cand, map[string]any{}); err != nil {
			continue
		}
		picked = append(picked, cand)
		if len(picked) >= want {
			break
		}
	}
	return picked
}

// fcResolve replaces #OPn throughout a case, keys included.
func fcResolve(node any, tokens map[string]string) any {
	switch v := node.(type) {
	case string:
		out := v
		for tok, val := range tokens {
			out = strings.ReplaceAll(out, tok, val)
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = fcResolve(item, tokens)
		}
		return out
	case map[string]any:
		out := map[string]any{}
		for k, item := range v {
			key, _ := fcResolve(k, tokens).(string)
			out[key] = fcResolve(item, tokens)
		}
		return out
	}
	return node
}

// fcTokensUsed reports the highest #OPn a case mentions. A case wanting more
// operations than this SDK offers is skipped rather than failed.
func fcTokensUsed(kase map[string]any) int {
	raw, err := json.Marshal(kase)
	if err != nil {
		return 0
	}
	max := 0
	s := string(raw)
	for i := 0; i+4 < len(s); i++ {
		if s[i:i+3] != "#OP" {
			continue
		}
		n := 0
		j := i + 3
		for j < len(s) && s[j] >= '0' && s[j] <= '9' {
			n = n*10 + int(s[j]-'0')
			j++
		}
		if n > max {
			max = n
		}
	}
	return max
}

func fcNum(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	}
	return 0, false
}

// fcSubset asserts that `actual` contains `expect`, recursively. Cases assert
// only the fields they are about, so a full deep-equal would force every case
// to restate the whole record.
//
// `actual` is a Go value, not a map: the aggregates live on the feature as
// typed structs, so an expected key is matched to an exported field by
// capitalising it.
func fcSubset(t *testing.T, actual any, expect any, path string) {
	t.Helper()

	if em, ok := expect.(map[string]any); ok {
		for k, want := range em {
			got, found := fcMember(actual, k)
			if !found {
				t.Errorf("%s.%s: no such member", path, k)
				continue
			}
			fcSubset(t, got, want, path+"."+k)
		}
		return
	}

	if wn, ok := fcNum(expect); ok {
		gn, ok := fcNum(actual)
		if !ok {
			t.Errorf("%s: expected number %v, got %v", path, expect, actual)
			return
		}
		// Money is float arithmetic; compare with a tolerance far below any
		// amount a case states.
		if diff := gn - wn; diff > 1e-9 || diff < -1e-9 {
			t.Errorf("%s: got %v, want %v", path, gn, wn)
		}
		return
	}

	if fmt.Sprintf("%v", actual) != fmt.Sprintf("%v", expect) {
		t.Errorf("%s: got %v, want %v", path, actual, expect)
	}
}

// fcMember reads one member from a struct (by capitalised field name), a
// pointer to one, or a map (by key).
func fcMember(actual any, key string) (any, bool) {
	if actual == nil {
		return nil, false
	}
	v := reflect.ValueOf(actual)
	for v.Kind() == reflect.Ptr || v.Kind() == reflect.Interface {
		if v.IsNil() {
			return nil, false
		}
		v = v.Elem()
	}

	switch v.Kind() {
	case reflect.Map:
		mv := v.MapIndex(reflect.ValueOf(key))
		if !mv.IsValid() {
			return nil, false
		}
		return mv.Interface(), true
	case reflect.Struct:
		f := v.FieldByName(strings.ToUpper(key[:1]) + key[1:])
		if !f.IsValid() {
			return nil, false
		}
		return f.Interface(), true
	}
	return nil, false
}

// fcRecord finds the named feature on the client and hands back the value
// carrying its aggregates. go keeps them on the feature; ts keeps them on the
// client. Same data, different home.
//
// Returned as the feature value itself, NOT type-asserted to a concrete
// feature type. Naming one here would be a compile-time reference to a
// feature the project may not have: `target add` trims unselected features,
// and this template is not trimmed with them, so an SDK generated without
// that feature would ship a test that does not build. featuresource.test.ts
// guards exactly that, and caught it - including, on its first pass, the
// spelling of the type inside this very comment.
//
// fcSubset reads the expected keys off the struct by capitalising them, so
// `total` finds Total, `ops` finds Ops, and a feature added later needs no
// new go here.
func fcRecord(client *sdk.ZefoyTiktokBotSDK, name string) any {
	for _, f := range client.Features {
		if f.GetName() == name {
			return f
		}
	}
	return nil
}

func TestFeatureCorpus(t *testing.T) {
	spec := loadTestSpec(t)

	featureSection := getSpec(spec, "feature")
	if featureSection == nil {
		// A corpus with no `feature` section is a SKIP, not a failure. Each
		// project carries its OWN materialised copy of .sdk/test/test.json, so a
		// project scaffolded before the section existed legitimately has no cases
		// to run - and a hard assertion here turned that into a red suite in every
		// SDK on the fleet, for a corpus the project had simply not re-pulled yet.
		// The strict check belongs where the corpus is CONTROLLED: sdkgen's own
		// end-to-end lane supplies one and requires the cases to actually run.
		t.Skip("this project's test.json has no `feature` section - recompile the corpus (create-sdkgen .sdk/test/feature/) to run these cases")
	}

	ops := fcUsableOps(2)

	// At least one operation, or every case below would skip and this would
	// report green having run nothing.
	if len(ops) == 0 {
		t.Fatal("no declared operation completed against a plain 200 - the " +
			"corpus cannot exercise a feature without one")
	}

	for _, name := range featureCorpusNames {
		name := name
		t.Run(name, func(t *testing.T) {
			section, _ := featureSection[name].(map[string]any)
			if section == nil {
				t.Skipf("no corpus section for %s", name)
			}

			basic, _ := section["basic"].(map[string]any)
			cases, _ := basic["set"].([]any)
			if len(cases) == 0 {
				t.Fatalf("corpus section feature.%s ran ZERO cases - a renamed "+
					"section or an emptied fixture must fail loudly", name)
			}

			// Only run what this SDK actually has, the same rule the rest of
			// the feature tests use. Probed by ACTIVATING it: the feature
			// defaults to inactive, so an idle client never constructs it and
			// its absence from Features says nothing about the SDK.
			probe := fcClient(map[string]any{
				"feature": []any{map[string]any{"name": name, "active": true}},
			})
			if fcRecord(probe, name) == nil {
				t.Skipf("this SDK was generated without the %s feature", name)
			}

			ran := 0
			for _, raw := range cases {
				kase, _ := raw.(map[string]any)
				if kase == nil {
					continue
				}

				need := fcTokensUsed(kase)
				if need > len(ops) {
					t.Logf("skip %q: needs %d operations, this SDK offers %d",
						kase["name"], need, len(ops))
					continue
				}

				tokens := map[string]string{}
				for i := 0; i < need; i++ {
					tokens[fmt.Sprintf("#OP%d", i+1)] = ops[i].key
				}
				resolved, _ := fcResolve(kase, tokens).(map[string]any)

				byKey := map[string]fcOp{}
				for _, o := range ops {
					byKey[o.key] = o
				}

				client := fcClient(resolved)
				label, _ := resolved["name"].(string)

				steps, _ := resolved["op"].([]any)
				for _, rawstep := range steps {
					step, _ := rawstep.(map[string]any)
					if step == nil {
						continue
					}
					opkey, _ := step["op"].(string)
					op, ok := byKey[opkey]
					if !ok {
						t.Errorf("%s: no operation %s", label, opkey)
						continue
					}
					ctrl := map[string]any{}
					if c, ok := step["ctrl"].(map[string]any); ok {
						ctrl = c
					}

					err := fcInvoke(client, op, ctrl)
					wanterr, haserr := step["err"]

					if !haserr {
						if err != nil {
							t.Errorf("%s: %s failed unexpectedly: %v", label, opkey, err)
						}
						continue
					}
					if err == nil {
						t.Errorf("%s: %s was expected to fail, and did not", label, opkey)
						continue
					}
					if code, ok := wanterr.(string); ok {
						// The CODE, not the message. The message is prefixed
						// and humanised by makeError, so matching its text
						// would pass on any error that happened to mention
						// the word.
						got := ""
						var sdkerr *sdk.ZefoyTiktokBotError
						if errors.As(err, &sdkerr) {
							got = sdkerr.Code
						}
						if got != code {
							t.Errorf("%s: wrong error code: got %q (%v), want %q",
								label, got, err, code)
						}
					}
				}

				fcSubset(t, fcRecord(client, name), resolved["out"], label+": _"+name)
				ran++
			}

			if ran == 0 {
				t.Fatalf("every feature.%s case was skipped", name)
			}
			// Say how many ran. A partial run is legitimate (an SDK with one
			// operation skips the cases needing two) but it should be visible
			// rather than inferred from a green tick.
			t.Logf("feature.%s: ran %d of %d case(s) against %d operation(s)",
				name, ran, len(cases), len(ops))
		})
	}
}
