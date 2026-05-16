
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
    ? `\n    ["${PROJECTNAME}_APIKEY"] = "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n      apikey = env["${PROJECTNAME}_APIKEY"],`
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

    Content(`-- ${entity.Name} direct test

local json = require("dkjson")
local vs = require("utility.struct.struct")
local sdk = require("${model.name}_sdk")
local helpers = require("core.helpers")
local runner = require("test.runner")

describe("${entity.Name}Direct", function()
`)

    if (hasList && listPoint) {
      const listLiveIdKeys: string[] = listParams.map((lp: any) => {
        return lp.name === 'id'
          ? entity.name + '01'
          : lp.name.replace(/_id$/, '') + '01'
      })
      const listSkipBlock = listLiveIdKeys.length > 0
        ? `    if setup.live then
      for _, _live_key in ipairs({${listLiveIdKeys.map(k => `"${k}"`).join(', ')}}) do
        if setup.idmap[_live_key] == nil then
          pending("live test needs " .. _live_key .. " via *_ENTID env var (synthetic IDs only)")
          return
        end
      end
    end
`
        : ''
      Content(`  it("should direct-list-${entity.name}", function()
    local setup = ${entity.name}_direct_setup({
      { id = "direct01" },
      { id = "direct02" },
    })
    local _should_skip, _reason = runner.is_control_skipped("direct", "direct-list-${entity.name}", setup.live and "live" or "unit")
    if _should_skip then
      pending(_reason or "skipped via sdk-test-control.json")
      return
    end
${listSkipBlock}    local client = setup.client

`)

      if (listParams.length > 0) {
        Content(`    local params = {}
`)
        for (const lp of listParams) {
          const key = lp.name === 'id'
            ? entity.name + '01'
            : lp.name.replace(/_id$/, '') + '01'
          Content(`    if setup.live then
      params["${lp.name}"] = setup.idmap["${key}"]
    else
      params["${lp.name}"] = "direct01"
    end
`)
        }
        Content(`
    local result, err = client:direct({
      path = "${listPath}",
      method = "GET",
      params = params,
    })
`)
      } else {
        Content(`
    local result, err = client:direct({
      path = "${listPath}",
      method = "GET",
      params = {},
    })
`)
      }

      Content(`    if setup.live then
      -- Live mode is lenient: synthetic IDs frequently 4xx and the list-
      -- response shape varies wildly across public APIs. Skip rather than
      -- fail when the call doesn't return a usable list.
      if err ~= nil then
        pending("list call failed (likely synthetic IDs against live API): " .. tostring(err))
        return
      end
      if not result["ok"] then
        pending("list call not ok (likely synthetic IDs against live API)")
        return
      end
      local status = helpers.to_int(result["status"])
      if status < 200 or status >= 300 then
        pending("expected 2xx status, got " .. tostring(status))
        return
      end
    else
      assert.is_nil(err)
      assert.is_true(result["ok"])
      assert.are.equal(200, helpers.to_int(result["status"]))
      assert.is_table(result["data"])
      assert.are.equal(2, #result["data"])
      assert.are.equal(1, #setup.calls)
    end
  end)

`)
    }

    if (hasLoad && loadPoint) {
      // Skip live direct-load only when we can't fill path params:
      // no spec examples and no list-bootstrap. Spec examples win first.
      const loadSkipBlock = (loadParams.length > 0 && !loadAllHaveExamples)
        ? `    if setup.live then
      pending("live direct-load needs real ID — set *_ENTID env var with real IDs to run")
      return
    end
`
        : ''
      Content(`  it("should direct-load-${entity.name}", function()
    local setup = ${entity.name}_direct_setup({ id = "direct01" })
    local _should_skip, _reason = runner.is_control_skipped("direct", "direct-load-${entity.name}", setup.live and "live" or "unit")
    if _should_skip then
      pending(_reason or "skipped via sdk-test-control.json")
      return
    end
${loadSkipBlock}    local client = setup.client

`)

      const needsQuery = loadParams.length > 0 || loadLiveQueryLines !== ''
      if (needsQuery) {
        Content(`    local params = {}
    local query = {}
`)
        if (loadAllHaveExamples) {
          Content(`    if setup.live then
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
            Content(`    if setup.live then
${loadLiveQueryLines}
    end
`)
          }
          Content(`    if not setup.live then
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`      params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
          Content(`    end
`)
        } else if (loadLiveQueryLines) {
          Content(`    if setup.live then
${loadLiveQueryLines}
    end
`)
        }
      }

      Content(`
    local result, err = client:direct({
      path = "${loadPath}",
      method = "GET",
`)
      if (needsQuery) {
        Content(`      params = params,
      query = query,
`)
      } else {
        Content(`      params = {},
`)
      }
      Content(`    })
    if setup.live then
      -- Live mode is lenient: synthetic IDs frequently 4xx. Skip rather
      -- than fail when the load endpoint isn't reachable with the IDs we
      -- can construct from setup.idmap.
      if err ~= nil then
        pending("load call failed (likely synthetic IDs against live API): " .. tostring(err))
        return
      end
      if not result["ok"] then
        pending("load call not ok (likely synthetic IDs against live API)")
        return
      end
      local status = helpers.to_int(result["status"])
      if status < 200 or status >= 300 then
        pending("expected 2xx status, got " .. tostring(status))
        return
      end
    else
      assert.is_nil(err)
      assert.is_true(result["ok"])
      assert.are.equal(200, helpers.to_int(result["status"]))
      assert.is_not_nil(result["data"])
      if type(result["data"]) == "table" then
        assert.are.equal("direct01", result["data"]["id"])
      end
      assert.are.equal(1, #setup.calls)
    end
  end)

`)
    }

    Content(`end)


function ${entity.name}_direct_setup(mockres)
  runner.load_env_local()

  local calls = {}

  local env = runner.env_override({
    ["${entidEnvVar}"] = {},
    ["${PROJECTNAME}_TEST_LIVE"] = "FALSE",${apikeyEnvEntry}
  })

  local live = env["${PROJECTNAME}_TEST_LIVE"] == "TRUE"

  if live then
    local merged_opts = {${apikeyLiveField}
    }
    local client = sdk.new(merged_opts)
    return {
      client = client,
      calls = calls,
      live = true,
      idmap = {},
    }
  end

  local function mock_fetch(url, init)
    table.insert(calls, { url = url, init = init })
    return {
      status = 200,
      statusText = "OK",
      headers = {},
      json = function()
        if mockres ~= nil then
          return mockres
        end
        return { id = "direct01" }
      end,
      body = "mock",
    }, nil
  end

  local client = sdk.new({
    base = "http://localhost:8080",
    system = {
      fetch = mock_fetch,
    },
  })

  return {
    client = client,
    calls = calls,
    live = false,
    idmap = {},
  }
end
`)
  })
})


export {
  TestDirect
}
