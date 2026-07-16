package sdktest

// Network-behaviour simulation over the offline mock transport. The `test`
// feature accepts an optional `net` config so unit tests can exercise slow,
// failing and offline conditions without a live server. These checks drive
// the transport through Direct(), which needs no entity, so they run for
// every generated SDK regardless of its API shape.

import (
	"testing"
	"time"

	sdk "GOMODULE"
)

func TestNetsim(t *testing.T) {

	t.Run("offline-simulation-fails-request", func(t *testing.T) {
		client := sdk.TestSDK(map[string]any{
			"net": map[string]any{"offline": true},
		}, nil)
		res, err := client.Direct(map[string]any{"path": "/ping"})
		if err != nil {
			t.Fatalf("Direct itself should not error: %v", err)
		}
		if res["ok"] != false {
			t.Errorf("offline network must fail the call, got %v", res)
		}
	})

	t.Run("failstatus-simulation-surfaces-status", func(t *testing.T) {
		client := sdk.TestSDK(map[string]any{
			"net": map[string]any{"failTimes": 1, "failStatus": 503},
		}, nil)
		res, err := client.Direct(map[string]any{"path": "/ping"})
		if err != nil {
			t.Fatalf("Direct itself should not error: %v", err)
		}
		if res["ok"] != false {
			t.Errorf("expected failed call, got %v", res)
		}
		if res["status"] != 503 {
			t.Errorf("expected simulated 503, got %v", res["status"])
		}
	})

	t.Run("latency-simulation-delays-request", func(t *testing.T) {
		delay := 60
		client := sdk.TestSDK(map[string]any{
			"net": map[string]any{"latency": delay},
		}, nil)
		start := time.Now()
		_, err := client.Direct(map[string]any{"path": "/ping"})
		if err != nil {
			t.Fatalf("Direct itself should not error: %v", err)
		}
		elapsed := time.Since(start).Milliseconds()
		// Generous lower bound to stay robust on slow CI.
		if elapsed < int64(delay-25) {
			t.Errorf("expected >= %dms latency, got %dms", delay-25, elapsed)
		}
	})

	t.Run("plain-test-sdk-works-without-net", func(t *testing.T) {
		client := sdk.TestSDK(nil, nil)
		if client == nil {
			t.Fatal("expected a client")
		}
	})
}
