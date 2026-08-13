package sdktest

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	sdk "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go"
	"github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/core"

	vs "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go/utility/struct"
)

func TestEngagementEntity(t *testing.T) {
	t.Run("instance", func(t *testing.T) {
		testsdk := sdk.TestSDK(nil, nil)
		ent := testsdk.Engagement(nil)
		if ent == nil {
			t.Fatal("expected non-nil EngagementEntity")
		}
	})

	t.Run("basic", func(t *testing.T) {
		setup := engagementBasicSetup(nil)
		// Per-op sdk-test-control.json skip — basic test exercises a flow
		// with multiple ops; skipping any op skips the whole flow.
		_mode := "unit"
		if setup.live {
			_mode = "live"
		}
		for _, _op := range []string{"create"} {
			if _shouldSkip, _reason := isControlSkipped("entityOp", "engagement." + _op, _mode); _shouldSkip {
				if _reason == "" {
					_reason = "skipped via sdk-test-control.json"
				}
				t.Skip(_reason)
				return
			}
		}
		// The basic flow consumes synthetic IDs from the fixture. In live mode
		// without an *_ENTID env override, those IDs hit the live API and 4xx.
		if setup.syntheticOnly {
			t.Skip("live entity test uses synthetic IDs from fixture — set ZEFOY_TIKTOK_BOT_TEST_ENGAGEMENT_ENTID JSON to run live")
			return
		}
		client := setup.client

		// CREATE
		engagementRef01Ent := client.Engagement(nil)
		engagementRef01Data := core.ToMapAny(vs.GetProp(
			vs.GetPath([]any{"new", "engagement"}, setup.data), "engagement_ref01"))

		engagementRef01DataResult, err := engagementRef01Ent.Create(engagementRef01Data, nil)
		if err != nil {
			t.Fatalf("create failed: %v", err)
		}
		engagementRef01Data = core.ToMapAny(entityData(engagementRef01DataResult))
		if engagementRef01Data == nil {
			t.Fatal("expected create result to be a map")
		}

	})
}

func engagementBasicSetup(extra map[string]any) *entityTestSetup {
	loadEnvLocal()

	_, filename, _, _ := runtime.Caller(0)
	dir := filepath.Dir(filename)

	entityDataFile := filepath.Join(dir, "..", "..", ".sdk", "test", "entity", "engagement", "EngagementTestData.json")

	entityDataSource, err := os.ReadFile(entityDataFile)
	if err != nil {
		panic("failed to read engagement test data: " + err.Error())
	}

	var entityData map[string]any
	if err := json.Unmarshal(entityDataSource, &entityData); err != nil {
		panic("failed to parse engagement test data: " + err.Error())
	}

	options := map[string]any{}
	options["entity"] = entityData["existing"]

	client := sdk.TestSDK(options, extra)

	// Generate idmap via transform, matching TS pattern.
	idmap := vs.Transform(
		[]any{"engagement01", "engagement02", "engagement03"},
		map[string]any{
			"`$PACK`": []any{"", map[string]any{
				"`$KEY`": "`$COPY`",
				"`$VAL`": []any{"`$FORMAT`", "upper", "`$COPY`"},
			}},
		},
	)

	// Detect ENTID env override before envOverride consumes it. When live
	// mode is on without a real override, the basic test runs against synthetic
	// IDs from the fixture and 4xx's. Surface this so the test can skip.
	entidEnvRaw := os.Getenv("ZEFOY_TIKTOK_BOT_TEST_ENGAGEMENT_ENTID")
	idmapOverridden := entidEnvRaw != "" && strings.HasPrefix(strings.TrimSpace(entidEnvRaw), "{")

	env := envOverride(map[string]any{
		"ZEFOY_TIKTOK_BOT_TEST_ENGAGEMENT_ENTID": idmap,
		"ZEFOY_TIKTOK_BOT_TEST_LIVE":      "FALSE",
		"ZEFOY_TIKTOK_BOT_TEST_EXPLAIN":   "FALSE",
		"ZEFOY_TIKTOK_BOT_APIKEY":         "NONE",
	})

	idmapResolved := core.ToMapAny(env["ZEFOY_TIKTOK_BOT_TEST_ENGAGEMENT_ENTID"])
	if idmapResolved == nil {
		idmapResolved = core.ToMapAny(idmap)
	}

	if env["ZEFOY_TIKTOK_BOT_TEST_LIVE"] == "TRUE" {
		mergedOpts := vs.Merge([]any{
			map[string]any{
				"apikey": env["ZEFOY_TIKTOK_BOT_APIKEY"],
			},
			extra,
		})
		client = sdk.NewZefoyTiktokBotSDK(core.ToMapAny(mergedOpts))
	}

	live := env["ZEFOY_TIKTOK_BOT_TEST_LIVE"] == "TRUE"
	return &entityTestSetup{
		client:        client,
		data:          entityData,
		idmap:         idmapResolved,
		env:           env,
		explain:       env["ZEFOY_TIKTOK_BOT_TEST_EXPLAIN"] == "TRUE",
		live:          live,
		syntheticOnly: live && !idmapOverridden,
		now:           time.Now().UnixMilli(),
	}
}
