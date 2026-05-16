/**
 * Shared utility functions for unit tests
 *
 * This module provides common helper functions used across unit tests
 * for creating test data, transformations, validations, and environment overrides.
 */

import * as Fs from 'node:fs'
import * as Path from 'node:path'


// Creates a new step data structure within the data model
function makeStepData(dm: Record<string, any>, stepname: string): Record<string, any> {
  dm.s[stepname] = {
    entity: undefined,
    match: undefined,
    reqdata: undefined,
    resdata: undefined,
  }
  return dm.s[stepname]
}


// Transforms and creates a match object using the provided transform function
function makeMatch(
  dm: Record<string, any>,
  transform: Function,
  match: any
): Record<string, any> {
  return transform({}, match, { meta: { dm } })
}


// Transforms and creates request data using the provided transform function
function makeReqdata(
  dm: Record<string, any>,
  transform: Function,
  data: any
): Record<string, any> {
  return transform({}, data, { meta: { dm } })
}


// Validates data against validation rules and returns the result
function makeValid(
  dm: Record<string, any>,
  validate: Function,
  data: any,
  valid: any
): Record<string, any> {
  valid["`$OPEN`"] = true
  return validate(data, valid, { meta: { '`$EXISTS`': true, dm } })
}


// Creates a control object for test explanations when enabled
function makeCtrl(explain: boolean) {
  return explain ? { explain: {} } : undefined
}
// CLAUDE: add a full stop to each function comment

// Overrides configuration values with environment variables if available
function envOverride(m: Record<string, any>) {
  if (
    'TRUE' === process.env.PROJECTNAME_TEST_LIVE ||
    'TRUE' === process.env.PROJECTNAME_TEST_OVERRIDE
  ) {
    Object.entries(m).map(n => {
      let envval = process.env[n[0]]
      if (null != envval) {
        envval = envval.trim()
        m[n[0]] = envval.startsWith('{') ? JSON.parse(envval) : envval
      }
    })
  }

  m.PROJECTNAME_TEST_EXPLAIN = process.env.PROJECTNAME_TEST_EXPLAIN || m.PROJECTNAME_TEST_EXPLAIN

  return m
}


// Loads sdk-test-control.json (cached). Returns an empty-skip object if
// the file is missing or unparsable so tests never crash on a bad config.
type TestControl = {
  version?: number
  test?: {
    skip?: {
      live?: { direct?: any[], entityOp?: any[] }
      unit?: { direct?: any[], entityOp?: any[] }
    }
    live?: { delayMs?: number }
    [k: string]: any
  }
  [k: string]: any
}

let _testControlCache: TestControl | null = null

function loadTestControl(): TestControl {
  if (_testControlCache) return _testControlCache
  const ctrlPath = Path.resolve(__dirname, '../test/sdk-test-control.json')
  try {
    _testControlCache = JSON.parse(Fs.readFileSync(ctrlPath, 'utf8')) as TestControl
  }
  catch {
    _testControlCache = {
      version: 1,
      test: { skip: { live: { direct: [], entityOp: [] }, unit: { direct: [], entityOp: [] } } }
    }
  }
  return _testControlCache!
}


// Returns the skip decision for a given test name from sdk-test-control.json.
// `kind` is 'direct' (matches by `test` field) or 'entityOp' (matches by
// `entity` + `op`). `mode` is 'live' or 'unit'.
function isControlSkipped(
  kind: 'direct' | 'entityOp',
  name: string,
  mode: 'live' | 'unit'
): { skip: boolean, reason?: string } {
  const ctrl = loadTestControl()
  const list = ctrl?.test?.skip?.[mode]?.[kind] ?? []
  for (const e of list) {
    if (kind === 'direct' && e?.test === name) {
      return { skip: true, reason: e.reason }
    }
    if (kind === 'entityOp') {
      const key = (e?.entity ?? '') + '.' + (e?.op ?? '')
      if (key === name) return { skip: true, reason: e.reason }
    }
  }
  return { skip: false }
}


// Skips the current test if sdk-test-control.json lists it. Returns true
// when skipped (caller should `return` immediately).
function maybeSkipControl(
  t: any,
  kind: 'direct' | 'entityOp',
  name: string,
  live: boolean
): boolean {
  const decision = isControlSkipped(kind, name, live ? 'live' : 'unit')
  if (decision.skip) {
    t.skip(decision.reason || 'skipped via sdk-test-control.json')
    return true
  }
  return false
}


// Skips the current live test when required idmap keys aren't supplied.
// Generated tests call this when they would otherwise pass `undefined`
// values into a path/query param and 4xx the request.
function skipIfMissingIds(t: any, setup: any, requiredKeys: string[]): boolean {
  if (!setup.live) return false
  const missing = requiredKeys.filter(k => null == setup.idmap?.[k])
  if (missing.length > 0) {
    t.skip(`live test needs ${missing.join(', ')} via *_ENTID env var (synthetic IDs only)`)
    return true
  }
  return false
}


// Per-test live pacing delay (ms). Read from sdk-test-control.json
// `test.live.delayMs`; defaults to 500ms if absent or invalid.
function liveDelayMs(): number {
  const ctrl = loadTestControl()
  const v = ctrl?.test?.live?.delayMs
  return ('number' === typeof v && v >= 0) ? v : 500
}


// afterEach hook helper for live pacing. Generated tests register this
// via `afterEach(liveDelay(<envVar>))`; it sleeps `liveDelayMs()` only
// when the SDK's *_TEST_LIVE env var is set.
function liveDelay(liveEnvVar: string): () => Promise<void> {
  return async () => {
    if ('TRUE' === process.env[liveEnvVar]) {
      await new Promise(r => setTimeout(r, liveDelayMs()))
    }
  }
}


export {
  makeStepData,
  makeMatch,
  makeReqdata,
  makeValid,
  makeCtrl,
  envOverride,
  loadTestControl,
  isControlSkipped,
  maybeSkipControl,
  skipIfMissingIds,
  liveDelayMs,
  liveDelay,
}
