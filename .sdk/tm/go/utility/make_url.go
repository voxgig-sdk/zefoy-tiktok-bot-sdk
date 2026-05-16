package utility

import (
	"regexp"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func makeUrlUtil(ctx *core.Context) (string, error) {
	spec := ctx.Spec
	result := ctx.Result

	if spec == nil {
		return "", ctx.MakeError("url_no_spec",
			"Expected context spec property to be defined.")
	}
	if result == nil {
		return "", ctx.MakeError("url_no_result",
			"Expected context result property to be defined.")
	}

	url := vs.Join([]any{spec.Base, spec.Prefix, spec.Path, spec.Suffix}, "/", true)
	resmatch := map[string]any{}

	params := spec.Params
	for _, item := range vs.Items(params) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil {
			re := regexp.MustCompile("\\{" + vs.EscRe(key) + "\\}")
			url = re.ReplaceAllString(url, vs.EscUrl(vs.Stringify(val)))
			resmatch[key] = val
		}
	}

	// Append query string from spec.Query.
	qsep := "?"
	for _, item := range vs.Items(spec.Query) {
		key, _ := item[0].(string)
		val := item[1]
		if val != nil {
			url += qsep + vs.EscUrl(key) + "=" + vs.EscUrl(vs.Stringify(val))
			qsep = "&"
			resmatch[key] = val
		}
	}

	result.Resmatch = resmatch

	return url, nil
}
