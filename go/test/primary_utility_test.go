package sdktest

import (
	"fmt"
	"strings"
	"testing"

	sdk "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go"

	vs "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/utility/struct"
)

func TestPrimaryUtility(t *testing.T) {
	spec := loadTestSpec(t)
	primary := getSpec(spec, "primary")
	if primary == nil {
		t.Fatal("primary section not found in test.json")
	}

	client := sdk.TestSDK(nil, nil)
	utility := client.GetUtility()

	t.Run("exists", func(t *testing.T) {
		if utility.Clean == nil {
			t.Error("Clean should not be nil")
		}
		if utility.Done == nil {
			t.Error("Done should not be nil")
		}
		if utility.MakeError == nil {
			t.Error("MakeError should not be nil")
		}
		if utility.FeatureAdd == nil {
			t.Error("FeatureAdd should not be nil")
		}
		if utility.FeatureHook == nil {
			t.Error("FeatureHook should not be nil")
		}
		if utility.FeatureInit == nil {
			t.Error("FeatureInit should not be nil")
		}
		if utility.Fetcher == nil {
			t.Error("Fetcher should not be nil")
		}
		if utility.MakeFetchDef == nil {
			t.Error("MakeFetchDef should not be nil")
		}
		if utility.MakeContext == nil {
			t.Error("MakeContext should not be nil")
		}
		if utility.MakeOptions == nil {
			t.Error("MakeOptions should not be nil")
		}
		if utility.MakeRequest == nil {
			t.Error("MakeRequest should not be nil")
		}
		if utility.MakeResponse == nil {
			t.Error("MakeResponse should not be nil")
		}
		if utility.MakeResult == nil {
			t.Error("MakeResult should not be nil")
		}
		if utility.MakePoint == nil {
			t.Error("MakePoint should not be nil")
		}
		if utility.MakeSpec == nil {
			t.Error("MakeSpec should not be nil")
		}
		if utility.MakeUrl == nil {
			t.Error("MakeUrl should not be nil")
		}
		if utility.Param == nil {
			t.Error("Param should not be nil")
		}
		if utility.PrepareAuth == nil {
			t.Error("PrepareAuth should not be nil")
		}
		if utility.PrepareBody == nil {
			t.Error("PrepareBody should not be nil")
		}
		if utility.PrepareHeaders == nil {
			t.Error("PrepareHeaders should not be nil")
		}
		if utility.PrepareMethod == nil {
			t.Error("PrepareMethod should not be nil")
		}
		if utility.PrepareParams == nil {
			t.Error("PrepareParams should not be nil")
		}
		if utility.PreparePath == nil {
			t.Error("PreparePath should not be nil")
		}
		if utility.PrepareQuery == nil {
			t.Error("PrepareQuery should not be nil")
		}
		if utility.ResultBasic == nil {
			t.Error("ResultBasic should not be nil")
		}
		if utility.ResultBody == nil {
			t.Error("ResultBody should not be nil")
		}
		if utility.ResultHeaders == nil {
			t.Error("ResultHeaders should not be nil")
		}
		if utility.TransformRequest == nil {
			t.Error("TransformRequest should not be nil")
		}
		if utility.TransformResponse == nil {
			t.Error("TransformResponse should not be nil")
		}
	})

	t.Run("clean-basic", func(t *testing.T) {
		ctx := makeTestCtx(client, utility, nil)
		val := map[string]any{"key": "secret123", "name": "test"}
		cleaned := utility.Clean(ctx, val)
		if cleaned == nil {
			t.Error("cleaned should not be nil")
		}
	})

	t.Run("done-basic", func(t *testing.T) {
		runsetNamed(t, "done", getSpec(primary, "done", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			fixctx(ctx, client)
			return utility.Done(ctx)
		})
	})

	t.Run("makeError-basic", func(t *testing.T) {
		runsetNamed(t, "makeError", getSpec(primary, "makeError", "basic"), func(entry map[string]any) (any, error) {
			args, _ := entry["args"].([]any)
			if len(args) == 0 {
				args = []any{map[string]any{}}
			}

			ctxmap, _ := args[0].(map[string]any)
			if ctxmap == nil {
				ctxmap = map[string]any{}
			}
			ctx := makeCtxFromMap(ctxmap, client, utility)
			fixctx(ctx, client)

			var err error
			if len(args) > 1 {
				if errMap, ok := args[1].(map[string]any); ok {
					err = errFromMap(errMap)
				}
			}

			return utility.MakeError(ctx, err)
		})
	})

	t.Run("makeError-no-throw", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		f := false
		ctx.Ctrl.Throw = &f
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":      false,
			"resdata": map[string]any{"id": "safe01"},
		})

		out, err := utility.MakeError(ctx, ctx.MakeError("test_code", "test message"))
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
		}
		if outMap, ok := out.(map[string]any); ok {
			if outMap["id"] != "safe01" {
				t.Errorf("expected id=safe01, got: %v", outMap["id"])
			}
		} else {
			t.Errorf("expected map result, got: %T", out)
		}
	})

	t.Run("featureAdd-basic", func(t *testing.T) {
		ctx := makeTestCtx(client, utility, nil)
		startLen := len(client.Features)

		feature := sdk.NewBaseFeature()
		utility.FeatureAdd(ctx, feature)

		if len(client.Features) != startLen+1 {
			t.Errorf("expected %d features, got %d", startLen+1, len(client.Features))
		}
	})

	t.Run("featureHook-basic", func(t *testing.T) {
		hookClient := sdk.TestSDK(nil, nil)
		hookUtility := hookClient.GetUtility()
		ctx := makeTestCtx(hookClient, hookUtility, nil)

		called := false
		hookFeature := &testHookFeature{
			BaseFeature: sdk.NewBaseFeature(),
			hookFn:      func() { called = true },
		}
		hookClient.Features = []sdk.Feature{hookFeature}

		hookUtility.FeatureHook(ctx, "TestHook")
		if !called {
			t.Error("expected TestHook to be called")
		}
	})

	t.Run("featureInit-basic", func(t *testing.T) {
		initClient := sdk.TestSDK(nil, nil)
		initUtility := initClient.GetUtility()
		ctx := makeTestCtx(initClient, initUtility, nil)
		ctx.Options["feature"] = map[string]any{
			"initfeat": map[string]any{"active": true},
		}

		initCalled := false
		feature := &testInitFeature{
			BaseFeature: sdk.NewBaseFeature(),
			name:        "initfeat",
			active:      true,
			initFn:      func() { initCalled = true },
		}

		initUtility.FeatureInit(ctx, feature)
		if !initCalled {
			t.Error("expected init to be called")
		}
	})

	t.Run("featureInit-inactive", func(t *testing.T) {
		initClient := sdk.TestSDK(nil, nil)
		initUtility := initClient.GetUtility()
		ctx := makeTestCtx(initClient, initUtility, nil)
		ctx.Options["feature"] = map[string]any{
			"nofeat": map[string]any{"active": false},
		}

		initCalled := false
		feature := &testInitFeature{
			BaseFeature: sdk.NewBaseFeature(),
			name:        "nofeat",
			active:      false,
			initFn:      func() { initCalled = true },
		}

		initUtility.FeatureInit(ctx, feature)
		if initCalled {
			t.Error("expected init NOT to be called for inactive feature")
		}
	})

	t.Run("fetcher-live", func(t *testing.T) {
		calls := []map[string]any{}
		liveClient := sdk.NewZefoyTiktokBotSDK(map[string]any{
			// Concrete base: a live construction must satisfy any server
			// variables a templated base URL declares; a literal base
			// sidesteps the requirement.
			"base": "http://localhost:8080",
			"system": map[string]any{
				"fetch": func(url string, fetchdef map[string]any) (map[string]any, error) {
					calls = append(calls, map[string]any{"url": url, "init": fetchdef})
					return map[string]any{"status": 200, "statusText": "OK"}, nil
				},
			},
		})
		liveUtility := liveClient.GetUtility()
		ctx := liveUtility.MakeContext(map[string]any{
			"opname":  "load",
			"client":  liveClient,
			"utility": liveUtility,
		}, nil)

		fetchdef := map[string]any{"method": "GET", "headers": map[string]any{}}
		_, err := liveUtility.Fetcher(ctx, "http://example.com/test", fetchdef)
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
		}
		if len(calls) != 1 {
			t.Errorf("expected 1 call, got %d", len(calls))
		}
		if calls[0]["url"] != "http://example.com/test" {
			t.Errorf("expected url http://example.com/test, got %v", calls[0]["url"])
		}
	})

	t.Run("fetcher-blocked-test-mode", func(t *testing.T) {
		// Create a live SDK then set mode to test (not using TestSDK, which installs test feature)
		blockedClient := sdk.NewZefoyTiktokBotSDK(map[string]any{
			"base": "http://localhost:8080",
			"system": map[string]any{
				"fetch": func(url string, fetchdef map[string]any) (map[string]any, error) {
					return map[string]any{}, nil
				},
			},
		})
		blockedClient.Mode = "test"

		blockedUtility := blockedClient.GetUtility()
		ctx := blockedUtility.MakeContext(map[string]any{
			"opname":  "load",
			"client":  blockedClient,
			"utility": blockedUtility,
		}, nil)

		fetchdef := map[string]any{"method": "GET", "headers": map[string]any{}}
		_, err := blockedUtility.Fetcher(ctx, "http://example.com/test", fetchdef)
		if err == nil {
			t.Error("expected error for test mode fetch")
		} else if !strings.Contains(err.Error(), "blocked") {
			t.Errorf("expected error containing 'blocked', got: %v", err)
		}
	})

	t.Run("makeContext-basic", func(t *testing.T) {
		runsetNamed(t, "makeContext", getSpec(primary, "makeContext", "basic"), func(entry map[string]any) (any, error) {
			in := entry["in"]
			if inMap, ok := in.(map[string]any); ok {
				ctx := utility.MakeContext(inMap, nil)
				out := map[string]any{
					"id": ctx.Id,
				}
				if ctx.Op != nil {
					out["op"] = map[string]any{
						"name":  ctx.Op.Name,
						"input": ctx.Op.Input,
					}
				}
				return out, nil
			}
			return nil, nil
		})
	})

	t.Run("makeFetchDef-basic", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "/api",
			"path":    "items/{id}",
			"suffix":  "",
			"params":  map[string]any{"id": "item01"},
			"query":   map[string]any{},
			"headers": map[string]any{"content-type": "application/json"},
			"method":  "GET",
			"step":    "start",
		})
		ctx.Result = sdk.NewResult(map[string]any{})

		fetchdef, err := utility.MakeFetchDef(ctx)
		if err != nil {
			t.Errorf("should not be error: %v", err)
			return
		}
		if fetchdef["method"] != "GET" {
			t.Errorf("expected method GET, got %v", fetchdef["method"])
		}
		url, _ := fetchdef["url"].(string)
		if !strings.Contains(url, "/api/items/item01") {
			t.Errorf("expected url to contain /api/items/item01, got %v", url)
		}
		if fetchdef["headers"].(map[string]any)["content-type"] != "application/json" {
			t.Error("expected content-type header")
		}
		if fetchdef["body"] != nil {
			t.Error("expected nil body")
		}
	})

	t.Run("makeFetchDef-with-body", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "",
			"path":    "items",
			"suffix":  "",
			"params":  map[string]any{},
			"query":   map[string]any{},
			"headers": map[string]any{},
			"method":  "POST",
			"step":    "start",
			"body":    map[string]any{"name": "test"},
		})
		ctx.Result = sdk.NewResult(map[string]any{})

		fetchdef, err := utility.MakeFetchDef(ctx)
		if err != nil {
			t.Errorf("should not be error: %v", err)
			return
		}
		if fetchdef["method"] != "POST" {
			t.Errorf("expected method POST, got %v", fetchdef["method"])
		}
		bodyStr, ok := fetchdef["body"].(string)
		if !ok {
			t.Errorf("expected body string, got %T", fetchdef["body"])
			return
		}
		if !strings.Contains(bodyStr, "\"name\"") {
			t.Errorf("expected body to contain name, got %v", bodyStr)
		}
	})

	t.Run("makeOptions-basic", func(t *testing.T) {
		runsetNamed(t, "makeOptions", getSpec(primary, "makeOptions", "basic"), func(entry map[string]any) (any, error) {
			in, _ := entry["in"].(map[string]any)
			ctx := utility.MakeContext(map[string]any{
				"options": in["options"],
				"config":  in["config"],
			}, nil)
			ctx.Client = client
			ctx.Utility = utility
			return utility.MakeOptions(ctx), nil
		})
	})

	t.Run("makeRequest-basic", func(t *testing.T) {
		runsetNamed(t, "makeRequest", getSpec(primary, "makeRequest", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			ctx.Options = client.OptionsMap()

			_, err := utility.MakeRequest(ctx)
			if err != nil {
				return nil, err
			}

			// Update entry ctx for match checking
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Response != nil {
				entryCtx["response"] = "exists"
			}
			if ctx.Result != nil {
				entryCtx["result"] = "exists"
			}

			return nil, nil
		})
	})

	t.Run("makeResponse-basic", func(t *testing.T) {
		runsetNamed(t, "makeResponse", getSpec(primary, "makeResponse", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			fixctx(ctx, client)

			_, err := utility.MakeResponse(ctx)
			if err != nil {
				return nil, err
			}

			// Update entry ctx for match checking with result data
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Result != nil {
				entryCtx["result"] = map[string]any{
					"ok":         ctx.Result.Ok,
					"status":     ctx.Result.Status,
					"statusText": ctx.Result.StatusText,
					"headers":    ctx.Result.Headers,
					"body":       ctx.Result.Body,
				}
			}

			return nil, nil
		})
	})

	t.Run("makeResult-basic", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{
			"base":    "http://localhost:8080",
			"prefix":  "/api",
			"path":    "items/{id}",
			"suffix":  "",
			"params":  map[string]any{"id": "item01"},
			"query":   map[string]any{},
			"headers": map[string]any{},
			"method":  "GET",
			"step":    "start",
		})
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":         true,
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
			"resdata":    map[string]any{"id": "item01", "name": "Test"},
		})

		result, err := utility.MakeResult(ctx)
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
			return
		}
		if result.Status != 200 {
			t.Errorf("expected status 200, got %d", result.Status)
		}
	})

	t.Run("makeResult-no-spec", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = nil
		ctx.Result = sdk.NewResult(map[string]any{
			"ok":         true,
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
		})

		_, err := utility.MakeResult(ctx)
		if err == nil {
			t.Error("expected error for nil spec")
		}
	})

	t.Run("makeResult-no-result", func(t *testing.T) {
		ctx := makeTestFullCtx(client, utility)
		ctx.Spec = sdk.NewSpec(map[string]any{"step": "start"})
		ctx.Result = nil

		_, err := utility.MakeResult(ctx)
		if err == nil {
			t.Error("expected error for nil result")
		}
	})

	t.Run("makeSpec-basic", func(t *testing.T) {
		setupOpts := getSpec(primary, "makeSpec", "DEF", "setup", "a")
		specClient := sdk.TestSDK(nil, setupOpts)
		specUtility := specClient.GetUtility()

		runsetNamed(t, "makeSpec", getSpec(primary, "makeSpec", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, specClient, specUtility)
			ctx.Options = specClient.OptionsMap()

			_, err := utility.MakeSpec(ctx)
			if err != nil {
				return nil, err
			}

			// Update entry ctx for match
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Spec != nil {
				entryCtx["spec"] = map[string]any{
					"base":    ctx.Spec.Base,
					"prefix":  ctx.Spec.Prefix,
					"suffix":  ctx.Spec.Suffix,
					"method":  ctx.Spec.Method,
					"params":  ctx.Spec.Params,
					"query":   ctx.Spec.Query,
					"headers": ctx.Spec.Headers,
					"step":    ctx.Spec.Step,
				}
			}

			return nil, nil
		})
	})

	t.Run("makePoint-basic", func(t *testing.T) {
		ctx := makeTestCtx(client, utility, nil)
		point := map[string]any{
			"parts":     []any{"items", "{id}"},
			"args":      map[string]any{"params": []any{}},
			"params":    []any{},
			"alias":     map[string]any{},
			"select":    map[string]any{},
			"active":    true,
			"transform": map[string]any{},
		}
		ctx.Op.Points = []map[string]any{point}

		_, err := utility.MakePoint(ctx)
		if err != nil {
			t.Errorf("expected no error, got: %v", err)
			return
		}
		if ctx.Point == nil {
			t.Error("expected point to be set")
		}
	})

	t.Run("makeUrl-basic", func(t *testing.T) {
		runsetNamed(t, "makeUrl", getSpec(primary, "makeUrl", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			if ctx.Result == nil {
				ctx.Result = sdk.NewResult(map[string]any{})
			}
			return utility.MakeUrl(ctx)
		})
	})

	t.Run("operator-basic", func(t *testing.T) {
		runsetNamed(t, "operator", getSpec(primary, "operator", "basic"), func(entry map[string]any) (any, error) {
			in, _ := entry["in"].(map[string]any)
			op := sdk.NewOperation(in)
			return map[string]any{
				"entity":  op.Entity,
				"name":    op.Name,
				"input":   op.Input,
				"points": op.Points,
			}, nil
		})
	})

	t.Run("param-basic", func(t *testing.T) {
		runsetNamed(t, "param", getSpec(primary, "param", "basic"), func(entry map[string]any) (any, error) {
			args, _ := entry["args"].([]any)
			if len(args) < 2 {
				return nil, nil
			}

			ctxmap, _ := args[0].(map[string]any)
			if ctxmap == nil {
				ctxmap = map[string]any{}
			}
			ctx := makeCtxFromMap(ctxmap, client, utility)
			paramdef := args[1]

			result := utility.Param(ctx, paramdef)

			// Update entry ctx for match
			if matchSpec, ok := entry["match"].(map[string]any); ok {
				if ctxMatch, ok := matchSpec["ctx"].(map[string]any); ok {
					entryCtx, _ := entry["ctx"].(map[string]any)
					if entryCtx == nil {
						entryCtx = map[string]any{}
						entry["ctx"] = entryCtx
					}
					// Copy spec alias back to entry ctx for matching
					if specMatch, ok := ctxMatch["spec"].(map[string]any); ok {
						if ctx.Spec != nil {
							if entryCtx["spec"] == nil {
								entryCtx["spec"] = map[string]any{}
							}
							if aliasMatch, ok := specMatch["alias"].(map[string]any); ok {
								_ = aliasMatch
								entryCtx["spec"] = map[string]any{
									"alias": ctx.Spec.Alias,
								}
							}
						}
					}
				}
			}

			return result, nil
		})
	})

	t.Run("prepareAuth-basic", func(t *testing.T) {
		setupOpts := getSpec(primary, "prepareAuth", "DEF", "setup", "a")
		authClient := sdk.TestSDK(nil, setupOpts)
		authUtility := authClient.GetUtility()

		runsetNamed(t, "prepareAuth", getSpec(primary, "prepareAuth", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, authClient, authUtility)
			fixctx(ctx, authClient)

			_, err := utility.PrepareAuth(ctx)
			if err != nil {
				return nil, err
			}

			// Update entry ctx for match
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Spec != nil {
				entryCtx["spec"] = map[string]any{
					"headers": ctx.Spec.Headers,
				}
			}

			return nil, nil
		})
	})

	t.Run("prepareBody-basic", func(t *testing.T) {
		runsetNamed(t, "prepareBody", getSpec(primary, "prepareBody", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			fixctx(ctx, client)
			return utility.PrepareBody(ctx), nil
		})
	})

	t.Run("prepareHeaders-basic", func(t *testing.T) {
		runsetNamed(t, "prepareHeaders", getSpec(primary, "prepareHeaders", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.PrepareHeaders(ctx), nil
		})
	})

	t.Run("prepareMethod-basic", func(t *testing.T) {
		runsetNamed(t, "prepareMethod", getSpec(primary, "prepareMethod", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.PrepareMethod(ctx), nil
		})
	})

	t.Run("prepareParams-basic", func(t *testing.T) {
		runsetNamed(t, "prepareParams", getSpec(primary, "prepareParams", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.PrepareParams(ctx), nil
		})
	})

	// Was two hand-written cases that had drifted out of the shared corpus
	// (the preparePath fixture shipped as an empty `set: []`). Now driven by
	// the corpus like every other section, so all ports assert the same
	// separator/blank-segment behaviour.
	t.Run("preparePath-basic", func(t *testing.T) {
		runsetNamed(t, "preparePath", getSpec(primary, "preparePath", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.PreparePath(ctx), nil
		})
	})

	t.Run("clean-corpus", func(t *testing.T) {
		runsetNamed(t, "clean", getSpec(primary, "clean", "basic"), func(entry map[string]any) (any, error) {
			args, _ := entry["args"].([]any)
			if 2 != len(args) {
				return nil, fmt.Errorf("clean: expected 2 args, got %d", len(args))
			}
			ctxmap, _ := args[0].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.Clean(ctx, args[1]), nil
		})
	})

	t.Run("prepareQuery-basic", func(t *testing.T) {
		runsetNamed(t, "prepareQuery", getSpec(primary, "prepareQuery", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			return utility.PrepareQuery(ctx), nil
		})
	})

	t.Run("resultBasic-basic", func(t *testing.T) {
		runsetNamed(t, "resultBasic", getSpec(primary, "resultBasic", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)
			fixctx(ctx, client)

			result := utility.ResultBasic(ctx)

			out := map[string]any{
				"status":     result.Status,
				"statusText": result.StatusText,
			}
			if result.Err != nil {
				out["err"] = map[string]any{
					"message": result.Err.Error(),
				}
			}

			return out, nil
		})
	})

	t.Run("resultBody-basic", func(t *testing.T) {
		runsetNamed(t, "resultBody", getSpec(primary, "resultBody", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)

			utility.ResultBody(ctx)

			// Update entry ctx for match
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Result != nil {
				entryCtx["result"] = map[string]any{
					"body": ctx.Result.Body,
				}
			}

			return nil, nil
		})
	})

	t.Run("resultHeaders-basic", func(t *testing.T) {
		runsetNamed(t, "resultHeaders", getSpec(primary, "resultHeaders", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)

			utility.ResultHeaders(ctx)

			// Update entry ctx for match
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Result != nil {
				entryCtx["result"] = map[string]any{
					"headers": ctx.Result.Headers,
				}
			}

			return nil, nil
		})
	})

	t.Run("transformRequest-basic", func(t *testing.T) {
		runsetNamed(t, "transformRequest", getSpec(primary, "transformRequest", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)

			result := utility.TransformRequest(ctx)

			// Update entry ctx for match (step changed)
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Spec != nil {
				if specMap, ok := entryCtx["spec"].(map[string]any); ok {
					specMap["step"] = ctx.Spec.Step
				}
			}

			return result, nil
		})
	})

	t.Run("transformResponse-basic", func(t *testing.T) {
		runsetNamed(t, "transformResponse", getSpec(primary, "transformResponse", "basic"), func(entry map[string]any) (any, error) {
			ctxmap, _ := entry["ctx"].(map[string]any)
			ctx := makeCtxFromMap(ctxmap, client, utility)

			result := utility.TransformResponse(ctx)

			// Update entry ctx for match (step changed)
			entryCtx, _ := entry["ctx"].(map[string]any)
			if ctx.Spec != nil {
				if specMap, ok := entryCtx["spec"].(map[string]any); ok {
					specMap["step"] = ctx.Spec.Step
				}
			}

			return result, nil
		})
	})
}

// Helper: test hook feature for featureHook test
type testHookFeature struct {
	*sdk.BaseFeature
	hookFn func()
}

func (f *testHookFeature) TestHook(ctx *sdk.Context) {
	if f.hookFn != nil {
		f.hookFn()
	}
}

// Helper: test init feature for featureInit test
type testInitFeature struct {
	*sdk.BaseFeature
	name   string
	active bool
	initFn func()
}

func (f *testInitFeature) GetName() string { return f.name }
func (f *testInitFeature) GetActive() bool { return f.active }
func (f *testInitFeature) Init(ctx *sdk.Context, options map[string]any) {
	if f.initFn != nil {
		f.initFn()
	}
}

// Helper: create basic test context
func makeTestCtx(client *sdk.ZefoyTiktokBotSDK, utility *sdk.Utility, overrides map[string]any) *sdk.Context {
	ctxmap := map[string]any{
		"opname":  "load",
		"client":  client,
		"utility": utility,
	}
	if overrides != nil {
		for k, v := range overrides {
			ctxmap[k] = v
		}
	}
	return utility.MakeContext(ctxmap, client.GetRootCtx())
}

// Helper: create full test context with point and match
func makeTestFullCtx(client *sdk.ZefoyTiktokBotSDK, utility *sdk.Utility) *sdk.Context {
	ctx := makeTestCtx(client, utility, nil)
	ctx.Point = map[string]any{
		"parts":     []any{"items", "{id}"},
		"args":      map[string]any{"params": []any{map[string]any{"name": "id", "reqd": true}}},
		"params":    []any{"id"},
		"alias":     map[string]any{},
		"select":    map[string]any{},
		"active":    true,
		"transform": map[string]any{},
	}
	ctx.Match = map[string]any{"id": "item01"}
	ctx.Reqmatch = map[string]any{"id": "item01"}
	return ctx
}

// useVS prevents unused import error
var _ = vs.Clone
