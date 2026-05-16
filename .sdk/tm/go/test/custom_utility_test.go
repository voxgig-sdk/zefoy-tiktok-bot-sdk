package sdktest

import (
	"testing"

	sdk "GOMODULE"
)

func TestCustomUtility(t *testing.T) {
	t.Run("basic", func(t *testing.T) {
		client := sdk.TestSDK(nil, map[string]any{
			"apikey": "APIKEY01",
			"utility": map[string]any{
				"auth":       func() map[string]any { return map[string]any{"util": "AUTH"} },
				"body":       func() map[string]any { return map[string]any{"util": "BODY"} },
				"contextify": func() map[string]any { return map[string]any{"util": "CONTEXTIFY"} },
				"done":       func() map[string]any { return map[string]any{"util": "DONE"} },
				"error":      func() map[string]any { return map[string]any{"util": "ERROR"} },
				"findparam":  func() map[string]any { return map[string]any{"util": "FINDPARAM"} },
				"fullurl":    func() map[string]any { return map[string]any{"util": "FULLURL"} },
				"headers":    func() map[string]any { return map[string]any{"util": "HEADERS"} },
				"method":     func() map[string]any { return map[string]any{"util": "METHOD"} },
				"operator":   func() map[string]any { return map[string]any{"util": "OPERATOR"} },
				"params":     func() map[string]any { return map[string]any{"util": "PARAMS"} },
				"query":      func() map[string]any { return map[string]any{"util": "QUERY"} },
				"reqform":    func() map[string]any { return map[string]any{"util": "REQFORM"} },
				"request":    func() map[string]any { return map[string]any{"util": "REQUEST"} },
				"resbasic":   func() map[string]any { return map[string]any{"util": "RESBASIC"} },
				"resbody":    func() map[string]any { return map[string]any{"util": "RESBODY"} },
				"resform":    func() map[string]any { return map[string]any{"util": "RESFORM"} },
				"resheaders": func() map[string]any { return map[string]any{"util": "RESHEADERS"} },
				"response":   func() map[string]any { return map[string]any{"util": "RESPONSE"} },
				"result":     func() map[string]any { return map[string]any{"util": "RESULT"} },
				"spec":       func() map[string]any { return map[string]any{"util": "SPEC"} },
			},
		})

		u := client.GetUtility()

		checks := map[string]string{
			"auth":       "AUTH",
			"body":       "BODY",
			"contextify": "CONTEXTIFY",
			"done":       "DONE",
			"error":      "ERROR",
			"findparam":  "FINDPARAM",
			"fullurl":    "FULLURL",
			"headers":    "HEADERS",
			"method":     "METHOD",
			"operator":   "OPERATOR",
			"params":     "PARAMS",
			"query":      "QUERY",
			"reqform":    "REQFORM",
			"request":    "REQUEST",
			"resbasic":   "RESBASIC",
			"resbody":    "RESBODY",
			"resform":    "RESFORM",
			"resheaders": "RESHEADERS",
			"response":   "RESPONSE",
			"result":     "RESULT",
			"spec":       "SPEC",
		}

		for key, expected := range checks {
			fn, ok := u.Custom[key]
			if !ok {
				t.Errorf("expected custom utility %q to exist", key)
				continue
			}
			if f, ok := fn.(func() map[string]any); ok {
				result := f()
				if result["util"] != expected {
					t.Errorf("custom utility %q: got %v, want %v", key, result["util"], expected)
				}
			} else {
				t.Errorf("custom utility %q: expected func() map[string]any, got %T", key, fn)
			}
		}
	})
}
