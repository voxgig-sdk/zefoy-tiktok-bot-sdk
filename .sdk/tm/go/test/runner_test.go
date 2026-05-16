package sdktest

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"testing"

	sdk "GOMODULE"

	vs "github.com/voxgig/struct"
)

var envLocalOnce sync.Once

func loadEnvLocal() {
	envLocalOnce.Do(func() {
		_, filename, _, _ := runtime.Caller(0)
		dir := filepath.Dir(filename)
		envFile := filepath.Join(dir, "..", "..", ".env.local")

		data, err := os.ReadFile(envFile)
		if err != nil {
			return
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				os.Setenv(key, val)
			}
		}
	})
}

func envOverride(m map[string]any) map[string]any {
	if os.Getenv("PROJECTNAME_TEST_LIVE") == "TRUE" ||
		os.Getenv("PROJECTNAME_TEST_OVERRIDE") == "TRUE" {
		for key := range m {
			envval := os.Getenv(key)
			if envval != "" {
				envval = strings.TrimSpace(envval)
				if strings.HasPrefix(envval, "{") {
					var parsed any
					if err := json.Unmarshal([]byte(envval), &parsed); err == nil {
						m[key] = parsed
						continue
					}
				}
				m[key] = envval
			}
		}
	}

	if explain := os.Getenv("PROJECTNAME_TEST_EXPLAIN"); explain != "" {
		m["PROJECTNAME_TEST_EXPLAIN"] = explain
	}

	return m
}

type entityTestSetup struct {
	client         *sdk.ZefoyTiktokBotSDK
	data           map[string]any
	idmap          map[string]any
	env            map[string]any
	explain        bool
	live           bool
	syntheticOnly  bool
	now            int64
}

var (
	cachedTestControl     map[string]any
	cachedTestControlOnce sync.Once
)

// loadTestControl reads sdk-test-control.json from this test dir; caches
// after first read. Returns an empty-skip default if the file is missing
// or invalid so tests never crash on a bad config.
func loadTestControl() map[string]any {
	cachedTestControlOnce.Do(func() {
		_, filename, _, _ := runtime.Caller(0)
		dir := filepath.Dir(filename)
		ctrlPath := filepath.Join(dir, "sdk-test-control.json")
		def := map[string]any{
			"version": 1,
			"test": map[string]any{"skip": map[string]any{
				"live": map[string]any{"direct": []any{}, "entityOp": []any{}},
				"unit": map[string]any{"direct": []any{}, "entityOp": []any{}},
			}},
		}
		data, err := os.ReadFile(ctrlPath)
		if err != nil {
			cachedTestControl = def
			return
		}
		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			cachedTestControl = def
			return
		}
		cachedTestControl = parsed
	})
	return cachedTestControl
}

// isControlSkipped checks sdk-test-control.json for a skip entry.
// Returns (skip, reason).
func isControlSkipped(kind, name, mode string) (bool, string) {
	ctrl := loadTestControl()
	test, _ := ctrl["test"].(map[string]any)
	if test == nil {
		return false, ""
	}
	skip, _ := test["skip"].(map[string]any)
	if skip == nil {
		return false, ""
	}
	modeMap, _ := skip[mode].(map[string]any)
	if modeMap == nil {
		return false, ""
	}
	items, _ := modeMap[kind].([]any)
	for _, raw := range items {
		item, _ := raw.(map[string]any)
		if item == nil {
			continue
		}
		reason, _ := item["reason"].(string)
		if kind == "direct" {
			if t, _ := item["test"].(string); t == name {
				return true, reason
			}
		}
		if kind == "entityOp" {
			ent, _ := item["entity"].(string)
			op, _ := item["op"].(string)
			if ent+"."+op == name {
				return true, reason
			}
		}
	}
	return false, ""
}

// liveDelayMs returns the configured per-test live delay in ms; default 500.
func liveDelayMs() int {
	ctrl := loadTestControl()
	test, _ := ctrl["test"].(map[string]any)
	if test == nil {
		return 500
	}
	live, _ := test["live"].(map[string]any)
	if live == nil {
		return 500
	}
	switch v := live["delayMs"].(type) {
	case float64:
		if v >= 0 {
			return int(v)
		}
	case int:
		if v >= 0 {
			return v
		}
	}
	return 500
}

var cachedTestSpec map[string]any

func loadTestSpec(t *testing.T) map[string]any {
	t.Helper()
	if cachedTestSpec != nil {
		return cachedTestSpec
	}
	data, err := os.ReadFile("../../.sdk/test/test.json")
	if err != nil {
		t.Fatalf("Failed to load test.json: %v", err)
	}
	var spec map[string]any
	if err := json.Unmarshal(data, &spec); err != nil {
		t.Fatalf("Failed to parse test.json: %v", err)
	}
	cachedTestSpec = spec
	return spec
}

func getSpec(spec map[string]any, keys ...string) map[string]any {
	var cur any = spec
	for _, key := range keys {
		if m, ok := cur.(map[string]any); ok {
			cur = m[key]
		} else {
			return nil
		}
	}
	if m, ok := cur.(map[string]any); ok {
		return m
	}
	return nil
}

type RunSubject func(entry map[string]any) (any, error)

func runset(t *testing.T, testspec map[string]any, subject RunSubject) {
	t.Helper()
	set, ok := testspec["set"].([]any)
	if !ok {
		return
	}

	for i, e := range set {
		entry, ok := e.(map[string]any)
		if !ok {
			continue
		}

		mark := ""
		if m := entry["mark"]; m != nil {
			mark = fmt.Sprintf(" (mark=%v)", m)
		}

		result, err := subject(entry)

		expectedErr := entry["err"]

		if err != nil {
			if expectedErr != nil {
				errMsg := err.Error()
				if expStr, ok := expectedErr.(string); ok {
					if !matchString(expStr, errMsg) {
						t.Errorf("entry %d%s: error mismatch: got %q, want contains %q",
							i, mark, errMsg, expStr)
					}
				} else if expBool, ok := expectedErr.(bool); ok && expBool {
					// err: true means any error is acceptable
				}
				if matchSpec, ok := entry["match"].(map[string]any); ok {
					resultMap := map[string]any{
						"in":  entry["in"],
						"out": jsonNormalize(result),
						"err": map[string]any{"message": err.Error()},
					}
					matchDeep(t, i, mark, matchSpec, resultMap, "")
				}
				continue
			}
			t.Errorf("entry %d%s: unexpected error: %v", i, mark, err)
			continue
		}

		if expectedErr != nil {
			t.Errorf("entry %d%s: expected error containing %q but got result: %v",
				i, mark, expectedErr, jsonStr(result))
			continue
		}

		matched := false
		if matchSpec, ok := entry["match"].(map[string]any); ok {
			resultMap := map[string]any{
				"in":  entry["in"],
				"out": jsonNormalize(result),
			}
			if args := entry["args"]; args != nil {
				resultMap["args"] = args
			} else if entry["in"] != nil {
				resultMap["args"] = []any{entry["in"]}
			}
			if ctxData := entry["ctx"]; ctxData != nil {
				resultMap["ctx"] = ctxData
			}
			matchDeep(t, i, mark, matchSpec, resultMap, "")
			matched = true
		}

		expectedOut := entry["out"]
		if expectedOut == nil && matched {
			continue
		}
		if expectedOut != nil {
			normResult := jsonNormalize(result)
			normExpected := jsonNormalize(expectedOut)
			if !reflect.DeepEqual(normResult, normExpected) {
				t.Errorf("entry %d%s: output mismatch:\n  got:  %v\n  want: %v",
					i, mark, jsonStr(normResult), jsonStr(normExpected))
			}
		}
	}
}

func jsonNormalize(val any) any {
	if val == nil {
		return nil
	}
	j, err := json.Marshal(val)
	if err != nil {
		return val
	}
	var out any
	json.Unmarshal(j, &out)
	return out
}

func jsonStr(val any) string {
	j, err := json.Marshal(val)
	if err != nil {
		return fmt.Sprintf("%v", val)
	}
	return string(j)
}

func matchDeep(t *testing.T, entryIdx int, mark string, check any, base any, path string) {
	t.Helper()

	if check == nil {
		return
	}

	checkMap, isMap := check.(map[string]any)
	checkList, isList := check.([]any)

	if isMap {
		for key, checkVal := range checkMap {
			childPath := path + "." + key
			var baseVal any
			if baseMap, ok := base.(map[string]any); ok {
				baseVal = baseMap[key]
			}
			matchDeep(t, entryIdx, mark, checkVal, baseVal, childPath)
		}
	} else if isList {
		for i, checkVal := range checkList {
			childPath := fmt.Sprintf("%s[%d]", path, i)
			var baseVal any
			if baseList, ok := base.([]any); ok && i < len(baseList) {
				baseVal = baseList[i]
			}
			matchDeep(t, entryIdx, mark, checkVal, baseVal, childPath)
		}
	} else {
		checkStr, isStr := check.(string)
		if isStr && checkStr == "__EXISTS__" {
			if base == nil {
				t.Errorf("entry %d%s: match %s: expected value to exist but got nil",
					entryIdx, mark, path)
			}
			return
		}
		if isStr && checkStr == "__UNDEF__" {
			if base != nil {
				t.Errorf("entry %d%s: match %s: expected nil but got %v",
					entryIdx, mark, path, base)
			}
			return
		}

		normCheck := jsonNormalize(check)
		normBase := jsonNormalize(base)

		if !reflect.DeepEqual(normCheck, normBase) {
			if isStr && checkStr != "" {
				baseStr := vs.Stringify(base)
				if matchString(checkStr, baseStr) {
					return
				}
			}
			t.Errorf("entry %d%s: match %s: got %v, want %v",
				entryIdx, mark, path, jsonStr(normBase), jsonStr(normCheck))
		}
	}
}

// matchString checks if val matches pattern. If pattern is /regex/, use regexp;
// otherwise do case-insensitive contains.
func matchString(pattern string, val string) bool {
	if len(pattern) >= 2 && pattern[0] == '/' && pattern[len(pattern)-1] == '/' {
		re, err := regexp.Compile(pattern[1 : len(pattern)-1])
		if err != nil {
			return false
		}
		return re.MatchString(val)
	}
	return strings.Contains(strings.ToLower(val), strings.ToLower(pattern))
}

// makeCtxFromMap creates a Context from a JSON test entry's ctx or args map.
func makeCtxFromMap(ctxmap map[string]any, client *sdk.ZefoyTiktokBotSDK, utility *sdk.Utility) *sdk.Context {
	if ctxmap == nil {
		ctxmap = map[string]any{}
	}

	ctx := sdk.NewContext(ctxmap, nil)

	if client != nil {
		ctx.Client = client
		ctx.Utility = utility
	}
	if ctx.Options == nil && client != nil {
		ctx.Options = client.OptionsMap()
	}

	// Handle spec from JSON map (NewContext expects *Spec, but JSON gives map)
	if specMap, ok := ctxmap["spec"].(map[string]any); ok {
		ctx.Spec = sdk.NewSpec(specMap)
	}

	// Handle result from JSON map
	if resMap, ok := ctxmap["result"].(map[string]any); ok {
		ctx.Result = sdk.NewResult(resMap)
		if errMap, ok := resMap["err"].(map[string]any); ok {
			if msg, ok := errMap["message"].(string); ok {
				ctx.Result.Err = &sdk.ZefoyTiktokBotError{Msg: msg}
			}
		}
	}

	// Handle response from JSON map
	if respMap, ok := ctxmap["response"].(map[string]any); ok {
		ctx.Response = sdk.NewResponse(respMap)
		if body := respMap["body"]; body != nil {
			bodyCopy := body
			ctx.Response.JsonFunc = func() any { return bodyCopy }
		}
		if headers, ok := respMap["headers"].(map[string]any); ok {
			lowerHeaders := map[string]any{}
			for k, v := range headers {
				lowerHeaders[strings.ToLower(k)] = v
			}
			ctx.Response.Headers = lowerHeaders
		}
	}

	return ctx
}

func fixctx(ctx *sdk.Context, client *sdk.ZefoyTiktokBotSDK) {
	if ctx != nil && ctx.Client != nil && ctx.Options == nil {
		ctx.Options = ctx.Client.OptionsMap()
	}
}

// errFromMap creates an error from a JSON map like {"message": "...", "code": "..."}
func errFromMap(m map[string]any) error {
	if m == nil {
		return nil
	}
	msg, _ := m["message"].(string)
	if msg == "" {
		return nil
	}
	code, _ := m["code"].(string)
	return &sdk.ZefoyTiktokBotError{Msg: msg, Code: code}
}

// ctxToMatchMap converts a Context to a map suitable for match comparison.
func ctxToMatchMap(ctx *sdk.Context) map[string]any {
	m := map[string]any{}

	if ctx.Spec != nil {
		spec := map[string]any{
			"base":    ctx.Spec.Base,
			"prefix":  ctx.Spec.Prefix,
			"suffix":  ctx.Spec.Suffix,
			"path":    ctx.Spec.Path,
			"method":  ctx.Spec.Method,
			"params":  ctx.Spec.Params,
			"query":   ctx.Spec.Query,
			"headers": ctx.Spec.Headers,
			"step":    ctx.Spec.Step,
			"alias":   ctx.Spec.Alias,
		}
		if ctx.Spec.Body != nil {
			spec["body"] = ctx.Spec.Body
		}
		if ctx.Spec.Url != "" {
			spec["url"] = ctx.Spec.Url
		}
		m["spec"] = spec
	}

	if ctx.Result != nil {
		res := map[string]any{
			"ok":         ctx.Result.Ok,
			"status":     ctx.Result.Status,
			"statusText": ctx.Result.StatusText,
			"headers":    ctx.Result.Headers,
		}
		if ctx.Result.Body != nil {
			res["body"] = ctx.Result.Body
		}
		if ctx.Result.Err != nil {
			res["err"] = map[string]any{
				"message": ctx.Result.Err.Error(),
			}
		}
		if ctx.Result.Resdata != nil {
			res["resdata"] = ctx.Result.Resdata
		}
		if ctx.Result.Resmatch != nil {
			res["resmatch"] = ctx.Result.Resmatch
		}
		m["result"] = res
	}

	if ctx.Response != nil {
		m["response"] = "exists"
	}

	return m
}

// entityListToData extracts data maps from a list of Entity objects.
func entityListToData(list []any) []any {
	var out []any
	for _, item := range list {
		if ent, ok := item.(sdk.Entity); ok {
			d := ent.Data()
			if dm, ok := d.(map[string]any); ok {
				out = append(out, dm)
			}
		} else if m, ok := item.(map[string]any); ok {
			out = append(out, m)
		}
	}
	if out == nil {
		out = []any{}
	}
	return out
}
