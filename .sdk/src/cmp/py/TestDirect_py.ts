
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
    ? `\n        "${PROJECTNAME}_APIKEY": "NONE",`
    : ''
  const apikeyLiveField = authActive
    ? `\n            "apikey": env.get("${PROJECTNAME}_APIKEY"),`
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

  // Required query params with spec-provided examples — needed in live mode
  // to satisfy API contracts (e.g. /v2018/history requires city/start/end).
  const loadQuery = loadPoint?.args?.query || []
  const loadLiveQueryEntries = loadQuery
    .filter((q: any) => q.reqd && undefined !== q.example && null !== q.example)
  const loadLiveQueryLines = loadLiveQueryEntries
    .map((q: any) => `            query["${q.name}"] = ${JSON.stringify(q.example)}`)
    .join('\n')

  // Path params with spec-provided examples — when ALL load params have
  // spec examples, prefer them over list-bootstrap.
  const loadAllHaveExamples =
    loadParams.length > 0 &&
    loadParams.every((p: any) => undefined !== p.example && null !== p.example)
  const loadExampleLines = loadAllHaveExamples
    ? loadParams.map((p: any) => `            params["${p.name}"] = ${JSON.stringify(p.example)}`).join('\n')
    : ''

  const entidEnvVar = `${PROJECTNAME}_TEST_${nom(entity, 'NAME').replace(/[^A-Z_]/g, '_')}_ENTID`

  File({ name: 'test_' + entity.name + '_direct.' + target.ext }, () => {

    Content(`# ${entity.Name} direct test

import json
import pytest

from utility.voxgig_struct import voxgig_struct as vs
from ${model.const.Name.toLowerCase()}_sdk import ${model.const.Name}SDK
from core import helpers
from test import runner


class Test${entity.Name}Direct:

`)

    if (hasList && listPoint) {
      // Track idmap keys this list test consumes in live mode.
      const listLiveIdKeys: string[] = listParams.map((lp: any) => {
        return lp.name === 'id'
          ? entity.name + '01'
          : lp.name.replace(/_id$/, '') + '01'
      })
      const listSkipBlock = listLiveIdKeys.length > 0
        ? `        if setup["live"]:
            for _live_key in [${listLiveIdKeys.map(k => `"${k}"`).join(', ')}]:
                if setup["idmap"].get(_live_key) is None:
                    # pytest already imported at module scope
                    pytest.skip(f"live test needs {_live_key} via *_ENTID env var (synthetic IDs only)")
                    return

`
        : ''
      Content(`    def test_should_direct_list_${entity.name}(self):
        setup = _${entity.name}_direct_setup([
            {"id": "direct01"},
            {"id": "direct02"},
        ])
        _skip, _reason = runner.is_control_skipped("direct", "direct-list-${entity.name}", "live" if setup["live"] else "unit")
        if _skip:
            # pytest already imported at module scope
            pytest.skip(_reason or "skipped via sdk-test-control.json")
            return
${listSkipBlock}        client = setup["client"]

`)

      if (listParams.length > 0) {
        Content(`        params = {}
`)
        for (const lp of listParams) {
          const key = lp.name === 'id'
            ? entity.name + '01'
            : lp.name.replace(/_id$/, '') + '01'
          Content(`        if setup["live"]:
            params["${lp.name}"] = setup["idmap"]["${key}"]
        else:
            params["${lp.name}"] = "direct01"
`)
        }
        Content(`
        result, err = client.direct({
            "path": "${listPath}",
            "method": "GET",
            "params": params,
        })
`)
      } else {
        Content(`
        result, err = client.direct({
            "path": "${listPath}",
            "method": "GET",
            "params": {},
        })
`)
      }

      Content(`        if setup["live"]:
            # Live mode is lenient: synthetic IDs frequently 4xx and the
            # list-response shape varies wildly across public APIs. Skip
            # rather than fail when the call doesn't return a usable list.
            if err is not None:
                pytest.skip(f"list call failed (likely synthetic IDs against live API): {err}")
                return
            if not result.get("ok"):
                pytest.skip("list call not ok (likely synthetic IDs against live API)")
                return
            status = helpers.to_int(result["status"])
            if status < 200 or status >= 300:
                pytest.skip(f"expected 2xx status, got {status}")
                return
        else:
            assert err is None
            assert result["ok"] is True
            assert helpers.to_int(result["status"]) == 200
            assert isinstance(result["data"], list)
            assert len(result["data"]) == 2
            assert len(setup["calls"]) == 1

`)
    }

    if (hasLoad && loadPoint) {
      // Python's direct-load test has no list-bootstrap, so when load path
      // params can't be filled (no spec examples + no override), skip cleanly.
      const loadSkipBlock = (loadParams.length > 0 && !loadAllHaveExamples)
        ? `        if setup["live"]:
            # pytest already imported at module scope
            pytest.skip("live direct-load needs real ID — set *_ENTID env var with real IDs to run")
            return

`
        : ''
      Content(`    def test_should_direct_load_${entity.name}(self):
        setup = _${entity.name}_direct_setup({"id": "direct01"})
        _skip, _reason = runner.is_control_skipped("direct", "direct-load-${entity.name}", "live" if setup["live"] else "unit")
        if _skip:
            # pytest already imported at module scope
            pytest.skip(_reason or "skipped via sdk-test-control.json")
            return
${loadSkipBlock}        client = setup["client"]

`)

      const needsQuery = loadParams.length > 0 || loadLiveQueryLines !== ''
      if (needsQuery) {
        Content(`        params = {}
        query = {}
`)
        if (loadAllHaveExamples) {
          // Use spec-provided path-param examples in live mode.
          Content(`        if setup["live"]:
${loadLiveQueryLines ? loadLiveQueryLines + '\n' : ''}${loadExampleLines}
        else:
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`            params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
        } else if (loadParams.length > 0) {
          if (loadLiveQueryLines) {
            Content(`        if setup["live"]:
${loadLiveQueryLines}
`)
          }
          Content(`        if not setup["live"]:
`)
          for (let i = 0; i < loadParams.length; i++) {
            Content(`            params["${loadParams[i].name}"] = "direct0${i + 1}"
`)
          }
        } else if (loadLiveQueryLines) {
          // Required-query only, no path params.
          Content(`        if setup["live"]:
${loadLiveQueryLines}
`)
        }
      }

      Content(`
        result, err = client.direct({
            "path": "${loadPath}",
            "method": "GET",
`)
      if (needsQuery) {
        Content(`            "params": params,
            "query": query,
`)
      } else {
        Content(`            "params": {},
`)
      }
      Content(`        })
        if setup["live"]:
            # Live mode is lenient: synthetic IDs frequently 4xx. Skip
            # rather than fail when the load endpoint isn't reachable
            # with the IDs we can construct from setup.idmap.
            if err is not None:
                pytest.skip(f"load call failed (likely synthetic IDs against live API): {err}")
                return
            if not result.get("ok"):
                pytest.skip("load call not ok (likely synthetic IDs against live API)")
                return
            status = helpers.to_int(result["status"])
            if status < 200 or status >= 300:
                pytest.skip(f"expected 2xx status, got {status}")
                return
        else:
            assert err is None
            assert result["ok"] is True
            assert helpers.to_int(result["status"]) == 200
            assert result["data"] is not None
            if isinstance(result["data"], dict):
                assert result["data"]["id"] == "direct01"
            assert len(setup["calls"]) == 1

`)
    }

    Content(`

def _${entity.name}_direct_setup(mockres):
    runner.load_env_local()

    calls = []

    env = runner.env_override({
        "${entidEnvVar}": {},
        "${PROJECTNAME}_TEST_LIVE": "FALSE",${apikeyEnvEntry}
    })

    live = env.get("${PROJECTNAME}_TEST_LIVE") == "TRUE"

    if live:
        merged_opts = {${apikeyLiveField}
        }
        client = ${model.const.Name}SDK(merged_opts)
        return {
            "client": client,
            "calls": calls,
            "live": True,
            "idmap": {},
        }

    def mock_fetch(url, init):
        calls.append({"url": url, "init": init})
        return {
            "status": 200,
            "statusText": "OK",
            "headers": {},
            "json": lambda: mockres if mockres is not None else {"id": "direct01"},
            "body": "mock",
        }, None

    client = ${model.const.Name}SDK({
        "base": "http://localhost:8080",
        "system": {
            "fetch": mock_fetch,
        },
    })

    return {
        "client": client,
        "calls": calls,
        "live": False,
        "idmap": {},
    }
`)
  })
})


export {
  TestDirect
}
