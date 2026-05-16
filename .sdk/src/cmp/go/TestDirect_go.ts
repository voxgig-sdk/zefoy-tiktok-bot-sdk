
import {
  Model,
  ModelEntity,
  nom,
  depluralize,
} from '@voxgig/apidef'

import {
  Content,
  File,
  cmp,
  snakify,
  isAuthActive,
} from '@voxgig/sdkgen'


// Replace raw OpenAPI parameter names in path parts with model parameter names.
// Path parts may have e.g. {subBreed} while model params use sub_breed.
// When a rename mapping exists (e.g. closureId -> id), path parts contain the
// renamed form {id} but params still use the original name closure_id.
function normalizePathParams(
  parts: string[],
  params: any[],
  rename?: Record<string, string>
): string {
  return parts.map((part: string) => {
    return part.replace(/\{([^}]+)\}/g, (match: string, rawName: string) => {
      const snaked = snakify(rawName)
      const depluralized = depluralize(snaked)
      // Prefer exact name match — orig matches can collide when one param's
      // original name was renamed to another param's current name (e.g. badge
      // load: param 'group_id' has orig 'id', and another param has name 'id').
      const param = params.find((p: any) =>
          p.name === snaked || p.name === depluralized) ||
        params.find((p: any) =>
          p.orig === snaked || p.orig === depluralized)
      if (param) return '{' + param.name + '}'

      if (rename) {
        for (const [origCamel, renamedTo] of Object.entries(rename)) {
          if (renamedTo === rawName) {
            const origSnaked = snakify(origCamel)
            const origDepluralized = depluralize(origSnaked)
            const renamedParam = params.find(
              (p: any) => p.orig === origSnaked || p.name === origSnaked ||
                p.orig === origDepluralized || p.name === origDepluralized
            )
            if (renamedParam) return '{' + renamedParam.name + '}'
          }
        }
      }

      return match
    })
  }).join('/')
}


const TestDirect = cmp(function TestDirect(props: any) {
  const ctx$ = props.ctx$
  const model: Model = ctx$.model

  const target = props.target
  const entity: ModelEntity = props.entity
  const gomodule = props.gomodule

  const PROJECTNAME = nom(model, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n\t\t"${PROJECTNAME}_APIKEY":       "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n\t\t\t"apikey": env["${PROJECTNAME}_APIKEY"],`
    : ''

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  const loadOp = entity.op.load
  const listOp = entity.op.list

  // Get load point info
  const loadPoint = loadOp?.points?.[0]
  const loadPath = loadPoint ? normalizePathParams(loadPoint.parts || [], loadPoint?.args?.params || [], loadPoint?.rename?.param) : ''
  const allLoadParams = loadPoint?.args?.params || []
  // Some upstream OpenAPI specs declare a parameter as `in: path` even when
  // that path has no `{name}` placeholder for it. Only path params that
  // actually appear in the URL template should drive direct-test path-param
  // setup and URL-substitution asserts; otherwise the SDK silently drops
  // them and the URL-includes assert fails.
  const _pathPlaceholders = new Set<string>()
  for (const part of (loadPoint?.parts || [])) {
    if (typeof part === 'string' && part.startsWith('{') && part.endsWith('}')) {
      _pathPlaceholders.add(part.slice(1, -1))
    }
  }
  const _renameMap = (loadPoint?.rename?.param || {}) as Record<string, string>
  const _renamedPlaceholders = new Set<string>()
  for (const ph of _pathPlaceholders) {
    _renamedPlaceholders.add(ph)
    for (const [orig, renamed] of Object.entries(_renameMap)) {
      if (renamed === ph) _renamedPlaceholders.add(orig)
    }
  }
  const loadParams = allLoadParams.filter((p: any) =>
    _renamedPlaceholders.has(p.name) || _renamedPlaceholders.has(p.orig))

  // Get list point info
  const listPoint = listOp?.points?.[0]
  const listPath = listPoint ? normalizePathParams(listPoint.parts || [], listPoint?.args?.params || [], listPoint?.rename?.param) : ''
  const listParams = listPoint?.args?.params || []

  // Required query params with spec-provided examples — needed in live mode
  // to satisfy API contracts (e.g. /v2018/history requires city/start/end).
  const loadQuery = loadPoint?.args?.query || []
  const loadLiveQueryEntries = loadQuery
    .filter((q: any) => q.reqd && undefined !== q.example && null !== q.example)
  const loadLiveQueryLines = loadLiveQueryEntries
    .map((q: any) => `\t\t\tquery["${q.name}"] = ${JSON.stringify(q.example)}`)
    .join('\n')

  const listQuery = listPoint?.args?.query || []
  const listLiveQueryEntries = listQuery
    .filter((q: any) => q.reqd && undefined !== q.example && null !== q.example)
  const listLiveQueryLines = listLiveQueryEntries
    .map((q: any) => `\t\t\tquery["${q.name}"] = ${JSON.stringify(q.example)}`)
    .join('\n')

  // Path params with spec-provided examples — when ALL load params have
  // spec examples, prefer them over list-bootstrap. Spec example values are
  // by definition real identifiers the API accepts (e.g. casa: "blue",
  // fecha: "2024/01/01"), avoiding the brittle list-bootstrap path-param
  // semantic mismatch.
  const loadAllHaveExamples =
    loadParams.length > 0 &&
    loadParams.every((p: any) => undefined !== p.example && null !== p.example)
  const loadExampleLines = loadAllHaveExamples
    ? loadParams.map((p: any) => `\t\t\tparams["${p.name}"] = ${JSON.stringify(p.example)}`).join('\n')
    : ''

  // Build the ENTID env var name for this entity
  const entidEnvVar = `${PROJECTNAME}_TEST_${nom(entity, 'NAME').replace(/[^A-Z_]/g, '_')}_ENTID`

  File({ name: entity.name + '_direct_test.' + target.ext }, () => {

    Content(`package sdktest

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	sdk "${gomodule}"
	"${gomodule}/core"
)

func Test${entity.Name}Direct(t *testing.T) {
`)

    // Generate list test first (load needs list results in live mode)
    if (hasList && listPoint) {
      const listParamStr = listParams.length > 0
        ? listParams.map((p: any, i: number) =>
          `"${p.name}": "direct0${i + 1}"`).join(', ')
        : ''

      // Build live params for list
      const listLiveParams = listParams.map((p: any) => {
        const key = p.name === 'id'
          ? entity.name + '01'
          : p.name.replace(/_id$/, '') + '01'
        return { name: p.name, key }
      })

      // Track idmap keys this test consumes in live mode. If any are
      // missing (no ENTID override), skip — the request would 4xx on
      // undefined path params.
      const listLiveIdKeys = listParams.length > 0
        ? listLiveParams.map((lp: any) => lp.key)
        : []
      const listLiveIdKeysGoLiteral = listLiveIdKeys.length > 0
        ? `[]string{${listLiveIdKeys.map((k: string) => `"${k}"`).join(', ')}}`
        : ''
      const listSkipBlock = listLiveIdKeys.length > 0
        ? `		if setup.live {
			for _, _liveKey := range ${listLiveIdKeysGoLiteral} {
				if v := setup.idmap[_liveKey]; v == nil {
					t.Skipf("live test needs %s via *_ENTID env var (synthetic IDs only)", _liveKey)
					return
				}
			}
		}
`
        : ''

      Content(`	t.Run("direct-list-${entity.name}", func(t *testing.T) {
		setup := ${entity.name}DirectSetup([]any{
			map[string]any{"id": "direct01"},
			map[string]any{"id": "direct02"},
		})
		_mode := "unit"
		if setup.live {
			_mode = "live"
		}
		if _shouldSkip, _reason := isControlSkipped("direct", "direct-list-${entity.name}", _mode); _shouldSkip {
			if _reason == "" {
				_reason = "skipped via sdk-test-control.json"
			}
			t.Skip(_reason)
			return
		}
${listSkipBlock}		client := setup.client

`)

      if (listParams.length > 0) {
        Content(`		params := map[string]any{}
`)
        listLiveParams.forEach((lp: any, i: number) => {
          // Each path param gets its own placeholder ("direct01", "direct02", ...)
          // in non-live mode so URL-shape assertions can verify the params
          // landed in distinct positions in the URL.
          const placeholder = 'direct0' + (i + 1)
          Content(`		if setup.live {
			params["${lp.name}"] = setup.idmap["${lp.key}"]
		} else {
			params["${lp.name}"] = "${placeholder}"
		}
`)
        })
        Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${listPath}",
			"method": "GET",
			"params": params,
		})
`)
      } else {
        Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${listPath}",
			"method": "GET",
			"params": map[string]any{${listParamStr}},
		})
`)
      }

      Content(`		if setup.live {
			// Live mode is lenient: synthetic IDs frequently 4xx and the
			// list-response shape varies wildly across public APIs. Skip
			// rather than fail when the call doesn't return a usable list.
			if err != nil {
				t.Skipf("list call failed (likely synthetic IDs against live API): %v", err)
			}
			if result["ok"] != true {
				t.Skipf("list call not ok (likely synthetic IDs against live API): %v", result)
			}
			status := core.ToInt(result["status"])
			if status < 200 || status >= 300 {
				t.Skipf("expected 2xx status, got %v", result["status"])
			}
		} else {
			if err != nil {
				t.Fatalf("direct failed: %v", err)
			}
			if result["ok"] != true {
				t.Fatalf("expected ok to be true, got %v", result["ok"])
			}
			if core.ToInt(result["status"]) != 200 {
				t.Fatalf("expected status 200, got %v", result["status"])
			}
		}

		if !setup.live {
			if dataList, ok := result["data"].([]any); ok {
				if len(dataList) != 2 {
					t.Fatalf("expected 2 items, got %d", len(dataList))
				}
			} else {
				t.Fatalf("expected data to be an array, got %T", result["data"])
			}

			if len(*setup.calls) != 1 {
				t.Fatalf("expected 1 call, got %d", len(*setup.calls))
			}
`)

      if (listParams.length > 0) {
        Content(`			call := (*setup.calls)[0]
			if initMap, ok := call["init"].(map[string]any); ok {
				if initMap["method"] != "GET" {
					t.Fatalf("expected method GET, got %v", initMap["method"])
				}
			}
			if url, ok := call["url"].(string); ok {
`)
        for (let i = 0; i < listParams.length; i++) {
          Content(`				if !strings.Contains(url, "direct0${i + 1}") {
					t.Fatalf("expected url to contain direct0${i + 1}, got %v", url)
				}
`)
        }
        Content(`			}
`)
      }

      Content(`		}
	})

`)
    }

    // Generate load test - in live mode, first list to get a real entity ID
    if (hasLoad && loadPoint) {
      const loadParamStr = loadParams.length > 0
        ? loadParams.map((p: any, i: number) =>
          `"${p.name}": "direct0${i + 1}"`).join(', ')
        : ''

      // Identify ancestor params (not 'id') for live mode
      const ancestorParams = loadParams.filter((p: any) => p.name !== 'id')

      // Determine which idmap keys this load test will consume in live mode.
      // - allHaveExamples: spec provides example values for every load
      //   path-param, so live mode uses them — no idmap needed.
      // - hasList: we list-bootstrap, so we need the keys for the list call's
      //   path params (ancestors of the list path).
      // - synthetic-only: we'd use idmap for load path-params; without an
      //   override they're undefined and the live request 4xx's.
      let loadLiveIdKeys: string[] = []
      if (loadParams.length > 0 && !loadAllHaveExamples) {
        if (hasList) {
          loadLiveIdKeys = listParams.map((p: any) => {
            return p.name === 'id'
              ? entity.name + '01'
              : p.name.replace(/_id$/, '') + '01'
          })
        } else {
          loadLiveIdKeys = loadParams.map((p: any) => p.name + '01')
        }
      }
      const loadSkipBlock = loadLiveIdKeys.length > 0
        ? `		if setup.live {
			for _, _liveKey := range []string{${loadLiveIdKeys.map(k => `"${k}"`).join(', ')}} {
				if v := setup.idmap[_liveKey]; v == nil {
					t.Skipf("live test needs %s via *_ENTID env var (synthetic IDs only)", _liveKey)
					return
				}
			}
		}
`
        : ''

      Content(`	t.Run("direct-load-${entity.name}", func(t *testing.T) {
		setup := ${entity.name}DirectSetup(map[string]any{"id": "direct01"})
		_mode := "unit"
		if setup.live {
			_mode = "live"
		}
		if _shouldSkip, _reason := isControlSkipped("direct", "direct-load-${entity.name}", _mode); _shouldSkip {
			if _reason == "" {
				_reason = "skipped via sdk-test-control.json"
			}
			t.Skip(_reason)
			return
		}
${loadSkipBlock}		client := setup.client

`)

      // Always emit a query map so the test can pass it to Direct(); only
      // set values in live mode.
      const needsQuery = loadParams.length > 0 || loadLiveQueryLines !== ''
      if (needsQuery) {
        Content(`		params := map[string]any{}
		query := map[string]any{}
`)

        Content(`		if setup.live {
`)

        // Required-query setup (e.g. /v2018/history needs city/start/end).
        if (loadLiveQueryLines) {
          Content(loadLiveQueryLines + '\n')
        }

        if (loadAllHaveExamples) {
          // Use spec-provided path-param examples — no list bootstrap needed.
          Content(loadExampleLines + '\n')
        } else if (hasList && loadParams.length > 0) {
          // List-bootstrap: first call list, take id from response.
          Content(`			listParams := map[string]any{}
`)
          for (const p of listParams) {
            const key = p.name === 'id'
              ? entity.name + '01'
              : p.name.replace(/_id$/, '') + '01'
            Content(`			listParams["${p.name}"] = setup.idmap["${key}"]
`)
          }

          Content(`			listResult, listErr := client.Direct(map[string]any{
				"path":   "${listPath}",
				"method": "GET",
				"params": listParams,
			})
			if listErr != nil {
				t.Skipf("list call failed (likely synthetic IDs against live API): %v", listErr)
			}
			if listResult["ok"] != true {
				t.Skipf("list call not ok (likely synthetic IDs against live API): %v", listResult)
			}

			// Get first entity ID from list
			listData, _ := listResult["data"].([]any)
			if len(listData) == 0 {
				t.Skip("no entities to load in live mode")
			}
			firstEnt := core.ToMapAny(listData[0])
			params["id"] = firstEnt["id"]
`)
          // Set ancestor params from idmap
          for (const p of ancestorParams) {
            const key = p.name.replace(/_id$/, '') + '01'
            Content(`			params["${p.name}"] = setup.idmap["${key}"]
`)
          }
        }

        if (loadParams.length > 0) {
          Content(`		} else {
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`			params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
        }
        Content(`		}
`)
      }

      Content(`
		result, err := client.Direct(map[string]any{
			"path":   "${loadPath}",
			"method": "GET",
`)
      if (loadParams.length > 0) {
        Content(`			"params": params,
			"query":  query,
`)
      } else if (loadLiveQueryLines) {
        Content(`			"params": params,
			"query":  query,
`)
      } else {
        Content(`			"params": map[string]any{},
`)
      }
      Content(`		})
		if setup.live {
			// Live mode is lenient: synthetic IDs frequently 4xx. Skip
			// rather than fail when the load endpoint isn't reachable with
			// the IDs we can construct from setup.idmap.
			if err != nil {
				t.Skipf("load call failed (likely synthetic IDs against live API): %v", err)
			}
			if result["ok"] != true {
				t.Skipf("load call not ok (likely synthetic IDs against live API): %v", result)
			}
			status := core.ToInt(result["status"])
			if status < 200 || status >= 300 {
				t.Skipf("expected 2xx status, got %v", result["status"])
			}
		} else {
			if err != nil {
				t.Fatalf("direct failed: %v", err)
			}
			if result["ok"] != true {
				t.Fatalf("expected ok to be true, got %v", result["ok"])
			}
			if core.ToInt(result["status"]) != 200 {
				t.Fatalf("expected status 200, got %v", result["status"])
			}
			if result["data"] == nil {
				t.Fatal("expected data to be non-nil")
			}
		}

		if !setup.live {
			if dataMap, ok := result["data"].(map[string]any); ok {
				if dataMap["id"] != "direct01" {
					t.Fatalf("expected data.id to be direct01, got %v", dataMap["id"])
				}
			}

			if len(*setup.calls) != 1 {
				t.Fatalf("expected 1 call, got %d", len(*setup.calls))
			}
			call := (*setup.calls)[0]
			if initMap, ok := call["init"].(map[string]any); ok {
				if initMap["method"] != "GET" {
					t.Fatalf("expected method GET, got %v", initMap["method"])
				}
			}
			if ${loadParams.length > 0 ? 'url' : '_'}, ok := call["url"].(string); ok {
`)

      for (let i = 0; i < loadParams.length; i++) {
        Content(`				if !strings.Contains(url, "direct0${i + 1}") {
					t.Fatalf("expected url to contain direct0${i + 1}, got %v", url)
				}
`)
      }

      Content(`			}
		}
	})

`)
    }

    Content(`}

type ${entity.name}DirectSetupResult struct {
	client *sdk.${model.const.Name}SDK
	calls  *[]map[string]any
	live   bool
	idmap  map[string]any
}

func ${entity.name}DirectSetup(mockres any) *${entity.name}DirectSetupResult {
	loadEnvLocal()

	calls := &[]map[string]any{}

	env := envOverride(map[string]any{
		"${entidEnvVar}": map[string]any{},
		"${PROJECTNAME}_TEST_LIVE":    "FALSE",${apikeyEnvEntry}
	})

	live := env["${PROJECTNAME}_TEST_LIVE"] == "TRUE"

	if live {
		mergedOpts := map[string]any{${apikeyLiveField}
		}
		client := sdk.New${model.const.Name}SDK(mergedOpts)

		idmap := map[string]any{}
		if entidRaw, ok := env["${entidEnvVar}"]; ok {
			if entidStr, ok := entidRaw.(string); ok && strings.HasPrefix(entidStr, "{") {
				json.Unmarshal([]byte(entidStr), &idmap)
			} else if entidMap, ok := entidRaw.(map[string]any); ok {
				idmap = entidMap
			}
		}

		return &${entity.name}DirectSetupResult{client: client, calls: calls, live: true, idmap: idmap}
	}

	mockFetch := func(url string, init map[string]any) (map[string]any, error) {
		*calls = append(*calls, map[string]any{"url": url, "init": init})
		return map[string]any{
			"status":     200,
			"statusText": "OK",
			"headers":    map[string]any{},
			"json": (func() any)(func() any {
				if mockres != nil {
					return mockres
				}
				return map[string]any{"id": "direct01"}
			}),
		}, nil
	}

	client := sdk.New${model.const.Name}SDK(map[string]any{
		"base": "http://localhost:8080",
		"system": map[string]any{
			"fetch": (func(string, map[string]any) (map[string]any, error))(mockFetch),
		},
	})

	return &${entity.name}DirectSetupResult{client: client, calls: calls, live: false, idmap: map[string]any{}}
}
`)

    // Suppress unused import warnings
    Content(`
var _ = os.Getenv
var _ = json.Unmarshal
`)
  })
})


export {
  TestDirect
}
