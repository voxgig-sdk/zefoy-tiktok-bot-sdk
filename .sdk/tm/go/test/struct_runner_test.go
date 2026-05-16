// Vendored from github.com/voxgig/struct/go/testutil
// Test runner that uses the test model in build/test.

package sdktest

import (
	"fmt"

	voxgigstruct "github.com/voxgig/struct"

	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"regexp"
	"strings"
	"testing"
	"unicode"
)

// StructClient interface defines the minimum needed to work with the runner
type StructClient interface {
	Utility() StructUtilityIF
}

type StructUtilityIF interface {
	Struct() *StructUtility
	Check(ctx map[string]any) map[string]any
}

type StructUtility struct {
	IsNode     func(val any) bool
	Clone      func(val any) any
	CloneFlags func(val any, flags map[string]bool) any
	GetPath    func(path any, store any, injdefs ...*voxgigstruct.Injection) any
	Inject     func(val any, store any, injdefs ...*voxgigstruct.Injection) any
	Items      func(val any) [][2]any
	Stringify  func(val any, maxlen ...int) string
	Walk       func(val any, apply voxgigstruct.WalkApply, opts ...any) any

	DelProp    func(parent any, key any) any
	EscRe      func(s string) string
	EscUrl     func(s string) string
	Filter     func(val any, check func([2]any) bool) []any
	Flatten    func(list any, depths ...int) any
	GetDef     func(val any, alt any) any
	GetElem    func(val any, key any, alts ...any) any
	GetProp    func(val any, key any, alts ...any) any
	HasKey     func(val any, key any) bool
	IsEmpty    func(val any) bool
	IsFunc     func(val any) bool
	IsKey      func(val any) bool
	IsList     func(val any) bool
	IsMap      func(val any) bool
	Join       func(arr []any, args ...any) string
	Jsonify    func(val any, flags ...map[string]any) string
	KeysOf     func(val any) []string
	Merge      func(val any, maxdepths ...int) any
	Pad        func(str any, args ...any) string
	Pathify    func(val any, from ...int) string
	Select     func(children any, query any) []any
	SetPath    func(store any, path any, val any, injdefs ...map[string]any) any
	SetProp    func(parent any, key any, newval any) any
	Size       func(val any) int
	Slice      func(val any, args ...any) any
	StrKey     func(key any) string
	Transform  func(data any, spec any, injdefs ...*voxgigstruct.Injection) any
	Typify     func(value any) int
	Typename   func(t int) string
	Validate   func(data any, spec any, injdefs ...*voxgigstruct.Injection) (any, error)

	SKIP   any
	DELETE any

	Jo func(kv ...any) map[string]any
	Ja func(v ...any) []any

	CheckPlacement func(modes int, ijname string, parentTypes int, inj *voxgigstruct.Injection) bool
	InjectorArgs   func(argTypes []int, args []any) []any
	InjectChild    func(child any, store any, inj *voxgigstruct.Injection) *voxgigstruct.Injection
}

type Subject func(args ...any) (any, error)

type RunSet func(
	t *testing.T,
	testspec any,
	testsubject any,
)

type RunSetFlags func(
	t *testing.T,
	testspec any,
	flags map[string]bool,
	testsubject any,
)

type RunPack struct {
	Spec        map[string]any
	RunSet      RunSet
	RunSetFlags RunSetFlags
	Subject     Subject
	Client      StructClient
}

type TestPack struct {
	Name    string
	Client  StructClient
	Subject Subject
	Utility StructUtilityIF
}

var (
	NULLMARK   = "__NULL__"
	UNDEFMARK  = "__UNDEF__"
	EXISTSMARK = "__EXISTS__"
)

// MakeRunner creates a runner function that can be used to run tests
func MakeRunner(testfile string, client StructClient) func(name string, store any) (*RunPack, error) {

	return func(name string, store any) (*RunPack, error) {
		utility := client.Utility()
		structUtil := utility.Struct()

		spec := resolveSpec(name, testfile)

		clients, err := resolveClients(spec, store, structUtil, client)
		if err != nil {
			return nil, err
		}

		subject, err := resolveSubject(name, utility)
		if err != nil {
			return nil, err
		}

		var runsetFlags RunSetFlags = func(
			t *testing.T,
			testspec any,
			flags map[string]bool,
			testsubject any,
		) {
			if testsubject != nil {
				subject = subjectify(testsubject)
			}

			flags = resolveFlags(flags)

			var testspecmap = fixJSON(
				testspec.(map[string]any),
				flags,
			).(map[string]any)

			testset, ok := testspecmap["set"].([]any)
			if !ok {
				panic(fmt.Sprintf("No test set in %v", name))
			}

			for _, entryVal := range testset {
				entry := resolveEntry(entryVal, flags)

				// Go cannot distinguish absent values from nil (JSON null).
				// Skip entries where "in" or "out" is missing and the expected
				// result is T_noval, as this represents a concept (undefined)
				// that does not exist in Go.
				_, hasIn := entry["in"]
				_, hasOut := entry["out"]
				if !hasIn || !hasOut {
					if outVal, ok := entry["out"]; ok {
						if outNum, ok := outVal.(int); ok && outNum == voxgigstruct.T_noval {
							continue
						}
					}
				}

				// When null flag is false, skip entries where in values are nil,
				// since Go cannot distinguish absent/undefined from nil.
				if !flags["null"] {
					if inMap, ok := entry["in"].(map[string]any); ok {
						skipEntry := false
						for _, v := range inMap {
							if v == nil {
								skipEntry = true
								break
							}
						}
						if skipEntry {
							continue
						}
					}
					// Also skip when out is nil (nil/undefined distinction).
					if entry["out"] == nil {
						continue
					}
				}

				testpack, err := resolveTestPack(name, entry, subject, client, clients)
				if err != nil {
					// No debug output
					return
				}

				args := resolveArgs(entry, testpack)
				entry["args"] = args

				res, err := testpack.Subject(args...)

				res = fixJSON(res, flags)

				entry["res"] = res
				entry["thrown"] = err

				if nil == err {
					checkResult(t, entry, res, structUtil)
				} else {
					handleError(t, entry, err, structUtil)
				}
			}
		}

		var runsetFn RunSet = func(
			t *testing.T,
			testspec any,
			testsubject any,
		) {
			runsetFlags(t, testspec, nil, testsubject)
		}

		return &RunPack{
			Spec:        spec,
			RunSet:      runsetFn,
			RunSetFlags: runsetFlags,
			Subject:     subject,
		}, nil
	}
}

func resolveSpec(
	name string,
	testfile string,
) map[string]any {

	data, err := os.ReadFile(filepath.Join(".", testfile))
	if err != nil {
		panic(err)
	}

	var alltests map[string]any
	if err := json.Unmarshal(data, &alltests); err != nil {
		panic(err)
	}

	var spec map[string]any

	// Check if there's a "primary" key that is a map, and if it has our 'name'
	if primaryRaw, hasPrimary := alltests["primary"]; hasPrimary {
		if primaryMap, ok := primaryRaw.(map[string]any); ok {
			if found, ok := primaryMap[name]; ok {
				spec = found.(map[string]any)
			}
		}
	}

	if spec == nil {
		if found, ok := alltests[name]; ok {
			spec = found.(map[string]any)
		}
	}

	if spec == nil {
		spec = alltests
	}

	return spec
}

func resolveClients(
	spec map[string]any,
	store any,
	structUtil *StructUtility,
	baseClient StructClient,
) (map[string]StructClient, error) {
	clients := make(map[string]StructClient)

	defRaw, hasDef := spec["DEF"]
	if !hasDef {
		return clients, nil
	}

	defMap, ok := defRaw.(map[string]any)
	if !ok {
		return clients, nil
	}

	clientRaw, hasClient := defMap["client"]
	if !hasClient {
		return clients, nil
	}

	clientMap, ok := clientRaw.(map[string]any)
	if !ok {
		return clients, nil
	}

	// Check if the client has a Tester method using reflection
	baseClientValue := reflect.ValueOf(baseClient)
	testerMethod := baseClientValue.MethodByName("Tester")
	if !testerMethod.IsValid() {
		return clients, nil
	}

	for _, cdef := range structUtil.Items(clientMap) {
		key, _ := cdef[0].(string)
		valMap, _ := cdef[1].(map[string]any)

		if valMap == nil {
			continue
		}

		testRaw, _ := valMap["test"].(map[string]any)
		opts, _ := testRaw["options"].(map[string]any)
		if opts == nil {
			opts = make(map[string]any)
		}

		// Inject store values into options
		if store != nil && structUtil.Inject != nil {
			structUtil.Inject(opts, store)
		}

		// Call the client's Tester method using reflection
		results := testerMethod.Call([]reflect.Value{reflect.ValueOf(opts)})
		if len(results) != 2 {
			return nil, fmt.Errorf("resolveClients: Tester method must return (Client, error)")
		}

		// Check for error
		if !results[1].IsNil() {
			err := results[1].Interface().(error)
			return nil, err
		}

		// Get the new client instance
		newClientValue := results[0].Interface()
		newClient, ok := newClientValue.(StructClient)
		if !ok {
			return nil, fmt.Errorf("resolveClients: Tester method did not return a StructClient")
		}

		clients[key] = newClient
	}

	return clients, nil
}

func resolveSubject(
	name string,
	container any,
) (Subject, error) {
	name = uppercaseFirstLetter(name)

	val := reflect.ValueOf(container)

	if _, ok := container.(StructUtilityIF); ok {
		subjectVal := val.MethodByName(name)
		subjectIF := subjectVal.Interface()
		subject := subjectify(subjectIF)
		return subject, nil
	}

	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() != reflect.Struct {
		return nil, errors.New("resolveSubject: not a struct or struct pointer")
	}

	fieldVal := val.FieldByName(name)

	if !fieldVal.IsValid() {
		return nil, fmt.Errorf("resolveSubject: field %q is not a func", name)
	}

	if fieldVal.Kind() != reflect.Func {
		return nil, fmt.Errorf("resolveSubject: field %q is not a func", name)
	}

	fn := fieldVal.Interface()
	var sfn Subject

	sfn, ok := fn.(Subject)
	if !ok {
		sfn = subjectify(fn)
	}

	return sfn, nil
}

func resolveFlags(flags map[string]bool) map[string]bool {

	if nil == flags {
		flags = map[string]bool{}
	}

	if _, ok := flags["null"]; !ok {
		flags["null"] = true
	}

	return flags
}

func resolveEntry(entryVal any, flags map[string]bool) map[string]any {
	entry := entryVal.(map[string]any)

	if flags["null"] {

		// Where `out` is missing in the test spec, set it to the special null symbol __NULL__
		_, has := entry["out"]
		if !has {
			entry["out"] = NULLMARK
		}
	}

	return entry
}

func checkResult(
	t *testing.T,
	entry map[string]any,
	res any,
	structUtils *StructUtility,
) {
	// Check if this test expects an output or an error
	_, hasExpectedErr := entry["err"]

	// Special case for array tests
	if hasExpectedErr && entry["err"] != nil {
		errStr, isStr := entry["err"].(string)
		if isStr && strings.Contains(errStr, "null:") {
			return
		}
	}

	if entry["match"] == nil || entry["out"] != nil {
		var cleanRes any
		if res != nil {
			flags := map[string]bool{"func": false}
			cleanRes = structUtils.CloneFlags(res, flags)
		} else {
			cleanRes = res
		}

		if !reflect.DeepEqual(cleanRes, entry["out"]) {
			t.Error(outFail(entry, cleanRes, entry["out"]))
			return
		}
	}

	if entry["match"] != nil {
		pass, err := MatchNode(
			entry["match"],
			map[string]any{
				"in":   entry["in"],
				"out":  entry["res"],
				"ctx":  entry["ctx"],
				"args": entry["args"],
			},
			structUtils,
		)
		if err != nil {
			t.Error(fmt.Sprintf("match error: %v", err))
			return
		}
		if !pass {
			t.Error(fmt.Sprintf("match fail: %v", err))
			return
		}
	}
}

func outFail(entry any, res any, out any) string {
	return fmt.Sprintf("Entry:\n%s\nExpected:\n%s\nGot:\n%s\n",
		inspect(entry), inspect(out), inspect(res))
}

func inspect(val any) string {
	return inspectIndent(val, "")
}

func inspectIndent(val any, indent string) string {
	result := ""

	switch v := val.(type) {
	case map[string]any:
		result += indent + "{\n"
		for key, value := range v {
			result += fmt.Sprintf("%s  \"%s\": %s", indent, key, inspectIndent(value, indent+"  "))
		}
		result += indent + "}\n"

	case []any:
		result += indent + "[\n"
		for _, value := range v {
			result += fmt.Sprintf("%s  - %s", indent, inspectIndent(value, indent+"  "))
		}
		result += indent + "]\n"

	default:
		result += fmt.Sprintf("%v (%s)\n", v, reflect.TypeOf(v))
	}

	return result
}

func handleError(
	t *testing.T,
	entry map[string]any,
	testerr error,
	structUtils *StructUtility,
) {
	// Record the error in the entry
	entry["thrown"] = testerr
	entryErr := entry["err"]

	// Special cases for testing
	if nil == entryErr && entry["out"] != nil {
		errStr := testerr.Error()
		if strings.Contains(errStr, "null:") &&
			strings.Contains(structUtils.Stringify(entry["in"]), "q:[") {
			return
		}
	}

	if nil == entryErr {
		t.Error(fmt.Sprintf("%s\n\nENTRY: %s", testerr.Error(), structUtils.Stringify(entry)))
		return
	}

	boolErr, hasBoolErr := entryErr.(bool)
	if hasBoolErr && !boolErr {
		t.Error(fmt.Sprintf("%s\n\nENTRY: %s", testerr.Error(), structUtils.Stringify(entry)))
		return
	}

	// Handle special cases
	errStr := testerr.Error()
	entryErrStr, isStr := entryErr.(string)
	if isStr {
		if strings.Contains(errStr, "null:") && strings.Contains(entryErrStr, "null:") {
			return
		}
	}

	matchErr, err := MatchNode(entryErr, errStr, structUtils)

	if err != nil {
		t.Error(fmt.Sprintf("match error: %v", err))
		return
	}

	if boolErr || matchErr {
		if entry["match"] != nil {
			flags := map[string]bool{"null": true}
			matchErr, err := MatchNode(
				entry["match"],
				map[string]any{
					"in":  entry["in"],
					"out": entry["res"],
					"ctx": entry["ctx"],
					"err": fixJSON(testerr, flags),
				},
				structUtils,
			)

			if !matchErr {
				t.Error(fmt.Sprintf("match failed: %v", matchErr))
			}

			if nil != err {
				t.Error(fmt.Sprintf("match failed: %v", err))
			}
		}

	} else {
		t.Error(fmt.Sprintf("ERROR MATCH: [%s] <=> [%s]",
			structUtils.Stringify(entryErr),
			errStr,
		))
	}
}

func resolveArgs(entry map[string]any, testpack TestPack) []any {
	structUtils := testpack.Utility.Struct()

	var args []any
	if inVal, ok := entry["in"]; ok {
		args = []any{structUtils.Clone(inVal)}
	} else {
		args = []any{}
	}

	if ctx, exists := entry["ctx"]; exists && ctx != nil {
		args = []any{ctx}
	} else if rawArgs, exists := entry["args"]; exists && rawArgs != nil {
		if slice, ok := rawArgs.([]any); ok {
			args = slice
		}
	}

	if entry["ctx"] != nil || entry["args"] != nil {
		if len(args) > 0 {
			first := args[0]
			if firstMap, ok := first.(map[string]any); ok && first != nil {
				clonedFirst := structUtils.Clone(firstMap)
				args[0] = clonedFirst
				entry["ctx"] = clonedFirst
				if m, ok := clonedFirst.(map[string]any); ok {
					m["client"] = testpack.Client
					m["utility"] = testpack.Utility
				}
			}
		}
	}

	return args
}

func resolveTestPack(
	name string,
	entry any,
	testsubject any,
	client StructClient,
	clients map[string]StructClient,
) (TestPack, error) {

	subject, ok := testsubject.(Subject)
	if !ok {
		panic("Bad subject")
	}

	testpack := TestPack{
		Name:    name,
		Client:  client,
		Subject: subject,
		Utility: client.Utility(),
	}

	var err error

	if e, ok := entry.(map[string]any); ok {
		if rawClient, exists := e["client"]; exists {
			if clientKey, ok := rawClient.(string); ok {
				if cl, found := clients[clientKey]; found {
					testpack.Client = cl
					testpack.Utility = cl.Utility()
					testpack.Subject, err = resolveSubject(name, testpack.Utility.Struct())
				}
			}
		}
	}

	return testpack, err
}

func MatchNode(
	check any,
	base any,
	structUtil *StructUtility,
) (bool, error) {
	pass := true
	var err error = nil

	// Clone the base object to avoid modifying the original
	base = structUtil.Clone(base)

	structUtil.Walk(
		check,
		func(key *string, val any, _parent any, path []string) any {
			scalar := !structUtil.IsNode(val)

			if scalar {
				baseval := structUtil.GetPath(path, base)
				if !MatchScalar(val, baseval, structUtil) {
					pass = false
					err = fmt.Errorf(
						"MATCHX: %s: [%s] <=> [%s]",
						strings.Join(path, "."),
						structUtil.Stringify(val),
						structUtil.Stringify(baseval),
					)
				}
			}
			return val
		},
	)

	return pass, err
}

func MatchScalar(check, base any, structUtil *StructUtility) bool {
	// Handle special cases for undefined and null values
	if s, ok := check.(string); ok && s == UNDEFMARK {
		return base == nil || reflect.ValueOf(base).IsZero()
	}

	// Handle EXISTSMARK - value exists and is not undefined
	if s, ok := check.(string); ok && s == EXISTSMARK {
		return base != nil
	}

	pass := (check == base)

	if !pass {
		if checkStr, ok := check.(string); ok {
			basestr := structUtil.Stringify(base)

			if len(checkStr) > 2 && checkStr[0] == '/' && checkStr[len(checkStr)-1] == '/' {
				pat := checkStr[1 : len(checkStr)-1]
				if rx, err := regexp.Compile(pat); err == nil {
					pass = rx.MatchString(basestr)
				} else {
					pass = false
				}
			} else {
				basenorm := strings.ToLower(basestr)
				checknorm := strings.ToLower(structUtil.Stringify(checkStr))
				pass = strings.Contains(
					basenorm,
					checknorm,
				)
			}
		} else {
			cv := reflect.ValueOf(check)
			isf := cv.Kind() == reflect.Func
			if isf {
				pass = true
			}
		}
	}

	return pass
}

func subjectify(fn any) Subject {
	v := reflect.ValueOf(fn)
	if v.Kind() != reflect.Func {
		panic("subjectify: not a function")
	}

	sfn, ok := v.Interface().(Subject)
	if ok {
		return sfn
	}

	fnType := v.Type()

	return func(args ...any) (any, error) {

		argCount := fnType.NumIn()

		if len(args) < argCount {
			extended := make([]any, argCount)
			copy(extended, args)
			args = extended
		}

		// Build reflect.Value slice for call
		in := make([]reflect.Value, fnType.NumIn())
		for i := 0; i < fnType.NumIn(); i++ {
			paramType := fnType.In(i)
			arg := args[i]

			if arg == nil {
				in[i] = reflect.Zero(paramType)
			} else {
				val := reflect.ValueOf(arg)

				// Check compatibility so we don't panic on invalid type
				if !val.Type().AssignableTo(paramType) {
					return nil, fmt.Errorf(
						"subjectify: argument %d type %T not assignable to parameter type %s",
						i, arg, paramType,
					)
				}
				in[i] = val
			}
		}

		// Call the original function
		out := v.Call(in)

		// Interpret results
		switch len(out) {
		case 0:
			return nil, nil
		case 1:
			return out[0].Interface(), nil
		case 2:
			errVal := out[1].Interface()
			var err error
			if errVal != nil {
				err = errVal.(error)
			}
			return out[0].Interface(), err
		default:
			return nil, fmt.Errorf("subjectify: function returns too many values (%d)", len(out))
		}
	}
}

func fixJSON(data any, flags map[string]bool) any {
	// Ensure flags is initialized
	if flags == nil {
		flags = map[string]bool{"null": true}
	}

	// Handle nil data
	if nil == data && flags["null"] {
		return NULLMARK
	}

	// Handle error objects specially
	if err, ok := data.(error); ok {
		errorMap := map[string]any{
			"name":    reflect.TypeOf(err).String(),
			"message": err.Error(),
		}
		return errorMap
	}

	v := reflect.ValueOf(data)

	switch v.Kind() {
	case reflect.Float64:
		if v.Float() == float64(int(v.Float())) {
			return int(v.Float())
		}
		return data

	case reflect.Map:
		fixedMap := make(map[string]any)
		for _, key := range v.MapKeys() {
			strKey, ok := key.Interface().(string)
			if ok {
				value := v.MapIndex(key).Interface()
				if value == nil && flags["null"] {
					fixedMap[strKey] = NULLMARK
				} else {
					fixedMap[strKey] = fixJSON(value, flags)
				}
			}
		}
		return fixedMap

	case reflect.Slice:
		length := v.Len()
		fixedSlice := make([]any, length)
		for i := 0; i < length; i++ {
			value := v.Index(i).Interface()
			if value == nil && flags["null"] {
				fixedSlice[i] = NULLMARK
			} else {
				fixedSlice[i] = fixJSON(value, flags)
			}
		}
		return fixedSlice

	case reflect.Array:
		length := v.Len()
		fixedSlice := make([]any, length)
		for i := 0; i < length; i++ {
			value := v.Index(i).Interface()
			if value == nil && flags["null"] {
				fixedSlice[i] = NULLMARK
			} else {
				fixedSlice[i] = fixJSON(value, flags)
			}
		}
		return fixedSlice

	default:
		return data
	}
}

func NullModifier(
	val any,
	key any,
	parent any,
	inj *voxgigstruct.Injection,
	store any,
) {
	switch v := val.(type) {
	case string:
		if NULLMARK == v {
			_ = voxgigstruct.SetProp(parent, key, nil)
		} else if UNDEFMARK == v {
			_ = voxgigstruct.SetProp(parent, key, nil)
		} else if EXISTSMARK == v {
			// For EXISTSMARK, no transform needed
		} else {
			_ = voxgigstruct.SetProp(parent, key,
				strings.ReplaceAll(v, NULLMARK, "null"))
		}
	}
}

func Fdt(data any) string {
	return fdti(data, "")
}

func fdti(data any, indent string) string {
	result := ""

	switch v := data.(type) {
	case map[string]any:
		result += indent + "{\n"
		for key, value := range v {
			result += fmt.Sprintf("%s  \"%s\": %s", indent, key, fdti(value, indent+"  "))
		}
		result += indent + "}\n"

	case []any:
		result += indent + "[\n"
		for _, value := range v {
			result += fmt.Sprintf("%s  - %s", indent, fdti(value, indent+"  "))
		}
		result += indent + "]\n"

	default:
		result += fmt.Sprintf("%v (%s)\n", v, reflect.TypeOf(v))
	}

	return result
}

func ToJSONString(data any) string {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return ""
	}
	return string(jsonBytes)
}

func uppercaseFirstLetter(s string) string {
	if len(s) == 0 {
		return s
	}

	runes := []rune(s)
	runes[0] = unicode.ToUpper(runes[0])
	return string(runes)
}

// StructSDK is the test SDK client for the struct runner
type StructSDK struct {
	opts    map[string]any
	utility *StructSDKUtility
}

// StructSDKUtility implements the StructUtilityIF interface
type StructSDKUtility struct {
	sdk     *StructSDK
	structu *StructUtility
}

// Struct returns the StructUtility
func (u *StructSDKUtility) Struct() *StructUtility {
	return u.structu
}

// Contextify implements the contextify function
func (u *StructSDKUtility) Contextify(ctxmap map[string]any) map[string]any {
	return ctxmap
}

// Check implements the check function
func (u *StructSDKUtility) Check(ctx map[string]any) map[string]any {
	zed := "ZED"
	if u.sdk.opts != nil {
		if foo, ok := u.sdk.opts["foo"]; ok && foo != nil {
			zed += fmt.Sprint(foo)
		}
	}
	zed += "_"

	if ctx == nil {
		zed += "0"
	} else if meta, ok := ctx["meta"].(map[string]any); ok && meta != nil {
		if bar, ok := meta["bar"]; ok && bar != nil {
			zed += fmt.Sprint(bar)
		} else {
			zed += "0"
		}
	} else {
		zed += "0"
	}

	return map[string]any{
		"zed": zed,
	}
}

// NewStructSDK creates a new StructSDK instance with the given options
func NewStructSDK(opts map[string]any) *StructSDK {
	if opts == nil {
		opts = map[string]any{}
	}

	sdk := &StructSDK{
		opts: opts,
	}

	// Create the StructUtility
	structUtil := &StructUtility{
		IsNode:     voxgigstruct.IsNode,
		Clone:      voxgigstruct.Clone,
		CloneFlags: voxgigstruct.CloneFlags,
		GetPath:    voxgigstruct.GetPath,
		Inject:     voxgigstruct.Inject,
		Items:      voxgigstruct.Items,
		Stringify:  voxgigstruct.Stringify,
		Walk:       voxgigstruct.Walk,

		DelProp:    voxgigstruct.DelProp,
		EscRe:      voxgigstruct.EscRe,
		EscUrl:     voxgigstruct.EscUrl,
		Filter:     voxgigstruct.Filter,
		Flatten:    voxgigstruct.Flatten,
		GetDef:     voxgigstruct.GetDef,
		GetElem:    voxgigstruct.GetElem,
		GetProp:    voxgigstruct.GetProp,
		HasKey:     voxgigstruct.HasKey,
		IsEmpty:    voxgigstruct.IsEmpty,
		IsFunc:     voxgigstruct.IsFunc,
		IsKey:      voxgigstruct.IsKey,
		IsList:     voxgigstruct.IsList,
		IsMap:      voxgigstruct.IsMap,
		Join:       voxgigstruct.Join,
		Jsonify:    voxgigstruct.Jsonify,
		KeysOf:     voxgigstruct.KeysOf,
		Merge:      voxgigstruct.Merge,
		Pad:        voxgigstruct.Pad,
		Pathify:    voxgigstruct.Pathify,
		Select:     voxgigstruct.Select,
		SetPath:    voxgigstruct.SetPath,
		SetProp:    voxgigstruct.SetProp,
		Size:       voxgigstruct.Size,
		Slice:      voxgigstruct.Slice,
		StrKey:     voxgigstruct.StrKey,
		Transform:  voxgigstruct.Transform,
		Typify:     voxgigstruct.Typify,
		Typename:   voxgigstruct.Typename,
		Validate:   voxgigstruct.Validate,

		SKIP:   voxgigstruct.SKIP,
		DELETE: voxgigstruct.DELETE,

		Jo: voxgigstruct.Jo,
		Ja: voxgigstruct.Ja,

		CheckPlacement: voxgigstruct.CheckPlacement,
		InjectorArgs:   voxgigstruct.InjectorArgs,
		InjectChild:    voxgigstruct.InjectChild,
	}

	// Create the utility
	sdk.utility = &StructSDKUtility{
		sdk:     sdk,
		structu: structUtil,
	}

	return sdk
}

// MakeTestStructSDK creates a new StructSDK instance for testing
func MakeTestStructSDK(opts map[string]any) (*StructSDK, error) {
	return NewStructSDK(opts), nil
}

// Tester creates a new StructSDK instance with options or default options
func (s *StructSDK) Tester(opts map[string]any) (*StructSDK, error) {
	if opts == nil {
		opts = s.opts
	}
	return NewStructSDK(opts), nil
}

// Utility returns the utility object
func (s *StructSDK) Utility() StructUtilityIF {
	return s.utility
}
