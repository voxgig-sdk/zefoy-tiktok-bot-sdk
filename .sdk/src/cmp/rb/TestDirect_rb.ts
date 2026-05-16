
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

  const PROJECTNAME = nom(model, 'Name').toUpperCase().replace(/[^A-Z_]/g, '_')

  const authActive = isAuthActive(model)
  const apikeyEnvEntry = authActive
    ? `\n    "${PROJECTNAME}_APIKEY" => "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n      "apikey" => env["${PROJECTNAME}_APIKEY"],`
    : ''

  const opnames = Object.keys(entity.op)
  const hasLoad = opnames.includes('load')
  const hasList = opnames.includes('list')

  if (!hasLoad && !hasList) {
    return
  }

  const loadOp = entity.op.load
  const listOp = entity.op.list

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

  const listPoint = listOp?.points?.[0]
  const listPath = listPoint ? normalizePathParams(listPoint.parts || [], listPoint?.args?.params || [], listPoint?.rename?.param) : ''
  const listParams = listPoint?.args?.params || []

  // Required query params with spec-provided examples — needed in live mode.
  const loadQuery = loadPoint?.args?.query || []
  const loadLiveQueryEntries = loadQuery
    .filter((q: any) => q.reqd && undefined !== q.example && null !== q.example)
  const loadLiveQueryLines = loadLiveQueryEntries
    .map((q: any) => `      query["${q.name}"] = ${JSON.stringify(q.example)}`)
    .join('\n')

  const loadAllHaveExamples =
    loadParams.length > 0 &&
    loadParams.every((p: any) => undefined !== p.example && null !== p.example)
  const loadExampleLines = loadAllHaveExamples
    ? loadParams.map((p: any) => `      params["${p.name}"] = ${JSON.stringify(p.example)}`).join('\n')
    : ''

  const entidEnvVar = `${PROJECTNAME}_TEST_${nom(entity, 'NAME').replace(/[^A-Z_]/g, '_')}_ENTID`

  File({ name: entity.name + '_direct_test.' + target.ext }, () => {

    Content(`# ${entity.Name} direct test

require "minitest/autorun"
require "json"
require_relative "../${model.const.Name}_sdk"
require_relative "runner"

class ${entity.Name}DirectTest < Minitest::Test
`)

    if (hasList && listPoint) {
      const listLiveIdKeys: string[] = listParams.map((lp: any) => {
        return lp.name === 'id'
          ? entity.name + '01'
          : lp.name.replace(/_id$/, '') + '01'
      })
      const listSkipBlock = listLiveIdKeys.length > 0
        ? `    if setup[:live]
      [${listLiveIdKeys.map(k => `"${k}"`).join(', ')}].each do |_live_key|
        if setup[:idmap][_live_key].nil?
          skip "live test needs #{_live_key} via *_ENTID env var (synthetic IDs only)"
          return
        end
      end
    end
`
        : ''
      Content(`  def test_direct_list_${entity.name}
    setup = ${entity.name}_direct_setup([
      { "id" => "direct01" },
      { "id" => "direct02" },
    ])
    _should_skip, _reason = Runner.is_control_skipped("direct", "direct-list-${entity.name}", setup[:live] ? "live" : "unit")
    if _should_skip
      skip(_reason || "skipped via sdk-test-control.json")
      return
    end
${listSkipBlock}    client = setup[:client]

`)

      if (listParams.length > 0) {
        Content(`    params = {}
`)
        for (const lp of listParams) {
          const key = lp.name === 'id'
            ? entity.name + '01'
            : lp.name.replace(/_id$/, '') + '01'
          Content(`    if setup[:live]
      params["${lp.name}"] = setup[:idmap]["${key}"]
    else
      params["${lp.name}"] = "direct01"
    end
`)
        }
        Content(`
    result, err = client.direct({
      "path" => "${listPath}",
      "method" => "GET",
      "params" => params,
    })
`)
      } else {
        Content(`
    result, err = client.direct({
      "path" => "${listPath}",
      "method" => "GET",
      "params" => {},
    })
`)
      }

      Content(`    if setup[:live]
      # Live mode is lenient: synthetic IDs frequently 4xx and the list-
      # response shape varies wildly across public APIs. Skip rather than
      # fail when the call doesn't return a usable list.
      if !err.nil?
        skip("list call failed (likely synthetic IDs against live API): #{err}")
        return
      end
      unless result["ok"]
        skip("list call not ok (likely synthetic IDs against live API)")
        return
      end
      status = Helpers.to_int(result["status"])
      if status < 200 || status >= 300
        skip("expected 2xx status, got #{status}")
        return
      end
    else
      assert_nil err
      assert result["ok"]
      assert_equal 200, Helpers.to_int(result["status"])
      assert result["data"].is_a?(Array)
      assert_equal 2, result["data"].length
      assert_equal 1, setup[:calls].length
    end
  end

`)
    }

    if (hasLoad && loadPoint) {
      // Skip live direct-load only when we can't fill path params:
      // no spec examples and no list-bootstrap. Spec examples win first.
      const loadSkipBlock = (loadParams.length > 0 && !loadAllHaveExamples)
        ? `    if setup[:live]
      skip "live direct-load needs real ID — set *_ENTID env var with real IDs to run"
      return
    end
`
        : ''
      Content(`  def test_direct_load_${entity.name}
    setup = ${entity.name}_direct_setup({ "id" => "direct01" })
    _should_skip, _reason = Runner.is_control_skipped("direct", "direct-load-${entity.name}", setup[:live] ? "live" : "unit")
    if _should_skip
      skip(_reason || "skipped via sdk-test-control.json")
      return
    end
${loadSkipBlock}    client = setup[:client]

`)

      const needsQuery = loadParams.length > 0 || loadLiveQueryLines !== ''
      if (needsQuery) {
        Content(`    params = {}
    query = {}
`)
        if (loadAllHaveExamples) {
          Content(`    if setup[:live]
`)
          if (loadLiveQueryLines) Content(loadLiveQueryLines + '\n')
          Content(loadExampleLines + '\n')
          Content(`    else
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`      params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
          Content(`    end
`)
        } else if (loadParams.length > 0) {
          if (loadLiveQueryLines) {
            Content(`    if setup[:live]
${loadLiveQueryLines}
    end
`)
          }
          Content(`    unless setup[:live]
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`      params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
          Content(`    end
`)
        } else if (loadLiveQueryLines) {
          Content(`    if setup[:live]
${loadLiveQueryLines}
    end
`)
        }
      }

      Content(`
    result, err = client.direct({
      "path" => "${loadPath}",
      "method" => "GET",
`)
      if (needsQuery) {
        Content(`      "params" => params,
      "query" => query,
`)
      } else {
        Content(`      "params" => {},
`)
      }
      Content(`    })
    if setup[:live]
      # Live mode is lenient: synthetic IDs frequently 4xx. Skip rather
      # than fail when the load endpoint isn't reachable with the IDs
      # we can construct from setup.idmap.
      if !err.nil?
        skip("load call failed (likely synthetic IDs against live API): #{err}")
        return
      end
      unless result["ok"]
        skip("load call not ok (likely synthetic IDs against live API)")
        return
      end
      status = Helpers.to_int(result["status"])
      if status < 200 || status >= 300
        skip("expected 2xx status, got #{status}")
        return
      end
    else
      assert_nil err
      assert result["ok"]
      assert_equal 200, Helpers.to_int(result["status"])
      assert !result["data"].nil?
      if result["data"].is_a?(Hash)
        assert_equal "direct01", result["data"]["id"]
      end
      assert_equal 1, setup[:calls].length
    end
  end

`)
    }

    Content(`end


def ${entity.name}_direct_setup(mockres)
  Runner.load_env_local

  calls = []

  env = Runner.env_override({
    "${entidEnvVar}" => {},
    "${PROJECTNAME}_TEST_LIVE" => "FALSE",${apikeyEnvEntry}
  })

  live = env["${PROJECTNAME}_TEST_LIVE"] == "TRUE"

  if live
    merged_opts = {${apikeyLiveField}
    }
    client = ${model.const.Name}SDK.new(merged_opts)
    return {
      client: client,
      calls: calls,
      live: true,
      idmap: {},
    }
  end

  mock_fetch = ->(url, init) {
    calls.push({ "url" => url, "init" => init })
    return {
      "status" => 200,
      "statusText" => "OK",
      "headers" => {},
      "json" => ->() {
        if !mockres.nil?
          return mockres
        end
        return { "id" => "direct01" }
      },
      "body" => "mock",
    }, nil
  }

  client = ${model.const.Name}SDK.new({
    "base" => "http://localhost:8080",
    "system" => {
      "fetch" => mock_fetch,
    },
  })

  {
    client: client,
    calls: calls,
    live: false,
    idmap: {},
  }
end
`)
  })
})


export {
  TestDirect
}
