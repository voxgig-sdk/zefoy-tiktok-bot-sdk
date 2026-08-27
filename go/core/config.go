package core

import (
	"sync"
)

// MakeConfig builds a fresh, fully materialised config map. Every call
// rebuilds the whole structure, so prefer SharedConfig unless you need a
// private copy you intend to mutate.
func MakeConfig() map[string]any {
	return map[string]any{
		"main": map[string]any{
			"name": "ZefoyTiktokBot",
			"slug": "zefoy-tiktok-bot",
			"version": "0.0.1",
			"target": "go",
		},
		"feature": map[string]any{
			"test": map[string]any{
				"options": map[string]any{
					"active": false,
				},
				"transport": "base",
			},
		},
		"options": map[string]any{
			"base": "https://zefoy.com",
			"auth": map[string]any{
				"prefix": "",
			},
			"headers": map[string]any{
				"content-type": "application/json",
			},
			"entity": map[string]any{
				"engagement": map[string]any{},
			},
		},
		"entity": map[string]any{
			"engagement": map[string]any{
				"fields": []any{
					map[string]any{
						"name": "amount",
						"short": "The amount of engagement to acquire (if applicable)",
						"type": "`$INTEGER`",
					},
					map[string]any{
						"name": "estimatedTime",
						"short": "Estimated time to complete in seconds",
						"type": "`$INTEGER`",
					},
					map[string]any{
						"name": "message",
						"short": "Response message",
						"type": "`$STRING`",
					},
					map[string]any{
						"name": "status",
						"short": "Current status of the boost request",
						"type": "`$STRING`",
					},
					map[string]any{
						"name": "success",
						"short": "Indicates if the request was successful",
						"type": "`$BOOLEAN`",
					},
					map[string]any{
						"name": "type",
						"op": map[string]any{
							"create": map[string]any{
								"req": true,
								"type": "`$STRING`",
							},
						},
						"short": "The type of engagement boosted",
						"type": "`$STRING`",
					},
					map[string]any{
						"name": "url",
						"req": true,
						"short": "The TikTok video or profile URL to boost",
						"type": "`$STRING`",
					},
				},
				"name": "engagement",
				"op": map[string]any{
					"create": map[string]any{
						"input": "data",
						"name": "create",
						"points": []any{
							map[string]any{
								"args": map[string]any{},
								"kind": "http",
								"method": "POST",
								"orig": "/api/boost",
								"parts": []any{
									"api",
									"boost",
								},
								"select": map[string]any{},
								"transform": map[string]any{
									"req": "`reqdata`",
									"res": "`body`",
								},
							},
						},
					},
				},
				"relations": map[string]any{
					"ancestors": []any{},
				},
			},
		},
	}
}

var (
	sharedConfigOnce sync.Once
	sharedConfigVal  map[string]any
)

// SharedConfig returns the process-wide config, built once on first use.
// The SDK reads the config on every request and never writes to it, so one
// instance is shared by every client rather than rebuilt per client.
//
// The returned map is shared: treat it as read-only. Callers that need to
// mutate should use MakeConfig, which always returns a fresh copy.
func SharedConfig() map[string]any {
	sharedConfigOnce.Do(func() {
		sharedConfigVal = MakeConfig()
	})
	return sharedConfigVal
}

func makeFeature(name string) Feature {
	switch name {
	case "test":
		if NewTestFeatureFunc != nil {
			return NewTestFeatureFunc()
		}
	default:
		if NewBaseFeatureFunc != nil {
			return NewBaseFeatureFunc()
		}
	}
	return nil
}
