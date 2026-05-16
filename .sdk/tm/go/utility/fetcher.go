package utility

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	vs "github.com/voxgig/struct"

	"GOMODULE/core"
)

func defaultHTTPFetch(fullurl string, fetchdef map[string]any) (map[string]any, error) {
	method, _ := fetchdef["method"].(string)
	if method == "" {
		method = "GET"
	}

	var bodyReader io.Reader
	if body, ok := fetchdef["body"].(string); ok && body != "" {
		bodyReader = strings.NewReader(body)
	}

	req, err := http.NewRequest(method, fullurl, bodyReader)
	if err != nil {
		return nil, err
	}

	hasUA := false
	if headers, ok := fetchdef["headers"].(map[string]any); ok {
		for k, v := range headers {
			if sv, ok := v.(string); ok {
				if strings.EqualFold(k, "user-agent") {
					hasUA = true
				}
				req.Header.Set(k, sv)
			}
		}
	}
	// Default User-Agent — Go's net/http defaults to "Go-http-client/1.1"
	// which some CDNs block. Use a Mozilla-shaped UA unless the caller
	// already set one.
	if !hasUA {
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; ZefoyTiktokBotSDK/1.0)")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	headers := map[string]any{}
	for k, vals := range resp.Header {
		if len(vals) == 1 {
			headers[strings.ToLower(k)] = vals[0]
		} else {
			headers[strings.ToLower(k)] = strings.Join(vals, ", ")
		}
	}

	var jsonBody any
	if len(bodyBytes) > 0 {
		json.Unmarshal(bodyBytes, &jsonBody)
	}

	statusText := resp.Status
	if idx := strings.Index(statusText, " "); idx >= 0 {
		statusText = statusText[idx+1:]
	}

	return map[string]any{
		"status":     resp.StatusCode,
		"statusText": statusText,
		"headers":    headers,
		"json":       (func() any)(func() any { return jsonBody }),
		"body":       string(bodyBytes),
	}, nil
}

func fetcherUtil(ctx *core.Context, fullurl string, fetchdef map[string]any) (any, error) {
	if ctx.Client.Mode != "live" {
		return nil, ctx.MakeError("fetch_mode_block",
			"Request blocked by mode: \""+ctx.Client.Mode+
				"\" (URL was: \""+fullurl+"\")")
	}

	options := ctx.Client.OptionsMap()
	if vs.GetPath([]any{"feature", "test", "active"}, options) == true {
		return nil, ctx.MakeError("fetch_test_block",
			"Request blocked as test feature is active"+
				" (URL was: \""+fullurl+"\")")
	}

	sysFetch := vs.GetPath([]any{"system", "fetch"}, options)

	if sysFetch == nil {
		return defaultHTTPFetch(fullurl, fetchdef)
	}

	if fetchFunc, ok := sysFetch.(func(string, map[string]any) (map[string]any, error)); ok {
		return fetchFunc(fullurl, fetchdef)
	}

	return nil, ctx.MakeError("fetch_invalid", "system.fetch is not a valid function")
}
