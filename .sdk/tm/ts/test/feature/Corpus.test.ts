
// Feature behaviour, driven by the SHARED corpus.
//
// This is the route PrimaryUtility.test.ts already takes for the utilities:
// language-neutral cases in .sdk/test/test.json, executed against the REAL
// generated SDK. Features here are ordinary classes in ordinary compiled
// source, unit-tested the ordinary way — no transpiled templates, and no
// miniature of the pipeline standing in for the pipeline (which is what
// harness.ts does, and why its assertions can only be as right as the
// miniature is). A feature is built through the generated config, wrapped
// into a client built by the generated constructor, and driven by a real
// entity operation. What is asserted is what ships.
//
// Everything in a case is data: features are activated by name, options are
// plain JSON, the transport is scripted by `res`, and the assertion is a
// subset of the client's own record. Turning `res` into a fetcher is the one
// piece each language writes for itself.

import { test, describe, before } from 'node:test'
import { ok, deepStrictEqual } from 'node:assert'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SDK, TEST_JSON_FILE } from '../utility/index'


// Features with a corpus section. A name here with no section is a skip, not
// a failure: an SDK generated without the feature has nothing to run.
const FEATURES = ['cost']


// One operation this SDK can actually perform.
type OpRef = {
  key: string        // '<entity>.<op>' — how features attribute it
  accessor: string   // the client method returning the entity
  entity: string
  op: string
}


// A scripted transport built from a case's `res` list. Responses are consumed
// in order and the last one repeats, so a case that does not care how many
// attempts happen need only declare one.
function scriptedFetcher(res: any[]) {
  let n = -1
  return async function (_ctx: any, _url: string, _fetchdef: any) {
    n++
    const spec = res[n < res.length ? n : res.length - 1] || {}

    if (true === spec.throw) {
      throw new Error('scripted transport failure')
    }

    const headers: Record<string, any> = spec.headers || {}
    const status = null == spec.status ? 200 : spec.status

    return {
      status,
      statusText: status < 400 ? 'OK' : 'ERR',
      body: 'not-used',
      json: async () => (undefined === spec.body ? {} : spec.body),
      headers: {
        get(key: string) {
          const lower = String(key).toLowerCase()
          for (const k of Object.keys(headers)) {
            if (k.toLowerCase() === lower) { return headers[k] }
          }
          return undefined
        },
        forEach(cb: any) { Object.keys(headers).forEach((k) => cb(headers[k], k, this)) },
      },
    }
  }
}


function makeClient(kase: any): any {
  return new (SDK as any)({
    feature: kase.feature,
    utility: { fetcher: scriptedFetcher(kase.res || [{ status: 200, body: {} }]) },
  })
}


// Every operation this SDK declares, in a stable order.
//
// The corpus cannot name an entity — it is shared by SDKs that have none in
// common — so the runner finds them here. The generated client exposes one
// capitalised, zero-argument accessor per entity, and the entity it returns
// carries the same `name` the config is keyed by; that pairing is what turns
// a config entry back into a callable method.
function candidates(client: any): OpRef[] {
  const entities: Record<string, any> = client._rootctx.config.entity || {}

  const accessor: Record<string, string> = {}
  for (const m of Object.getOwnPropertyNames(Object.getPrototypeOf(client))) {
    if (!/^[A-Z]/.test(m) || 'function' !== typeof client[m]) { continue }
    let inst: any
    try { inst = client[m]() }
    catch (e) { continue }
    if (null != inst && 'string' === typeof inst.name && null != entities[inst.name]) {
      accessor[inst.name] = m
    }
  }

  const out: OpRef[] = []
  for (const entity of Object.keys(entities).sort()) {
    if (null == accessor[entity]) { continue }
    for (const op of Object.keys(entities[entity].op || {}).sort()) {
      out.push({ key: entity + '.' + op, accessor: accessor[entity], entity, op })
    }
  }
  return out
}


// Pick operations the corpus can drive, by DRIVING them: an op is usable when
// it completes against a plain 200 with no feature active. Declared ops are
// not all callable with no arguments (a required path parameter, a body), and
// a case that failed for that reason would look like a feature defect.
async function usableOps(want: number): Promise<OpRef[]> {
  const picked: OpRef[] = []
  for (const cand of candidates(makeClient({}))) {
    const client = makeClient({})
    try {
      await client[cand.accessor]()[cand.op]({}, {})
    }
    catch (e) { continue }
    picked.push(cand)
    if (want <= picked.length) { break }
  }
  return picked
}


// Replace #OP1/#OP2 throughout a case, keys included.
function resolve(node: any, tokens: Record<string, string>): any {
  if ('string' === typeof node) {
    let s = node
    for (const t of Object.keys(tokens)) { s = s.split(t).join(tokens[t]) }
    return s
  }
  if (Array.isArray(node)) {
    return node.map((n) => resolve(n, tokens))
  }
  if (null != node && 'object' === typeof node) {
    const out: any = {}
    for (const k of Object.keys(node)) {
      out[resolve(k, tokens)] = resolve(node[k], tokens)
    }
    return out
  }
  return node
}


// Which #OPn tokens a case uses. A case wanting more operations than this SDK
// has is skipped rather than failed.
function tokensUsed(kase: any): number {
  const m = JSON.stringify(kase).match(/#OP(\d+)/g) || []
  return m.reduce((max, t) => Math.max(max, Number(t.slice(3))), 0)
}


// Assert that `actual` contains `expect`, recursively. Cases assert only the
// fields they are about, so a full deepStrictEqual would force every case to
// restate the whole record.
function subset(actual: any, expect: any, path: string) {
  if (null != expect && 'object' === typeof expect && !Array.isArray(expect)) {
    for (const k of Object.keys(expect)) {
      ok(null != actual, `${path}.${k}: nothing at ${path}`)
      subset(actual[k], expect[k], `${path}.${k}`)
    }
    return
  }
  deepStrictEqual(actual, expect, path)
}


describe('FeatureCorpus', () => {

  let corpus: any
  let ops: OpRef[] = []
  let byKey: Record<string, OpRef> = {}


  before(async () => {
    corpus = JSON.parse(readFileSync(join(__dirname, '..', TEST_JSON_FILE), 'utf8'))
    ops = await usableOps(2)
    byKey = {}
    for (const o of ops) { byKey[o.key] = o }
  })


  // A corpus with no `feature` section is a SKIP, not a failure.
  //
  // Each project carries its OWN materialised copy of .sdk/test/test.json, so
  // a project scaffolded before the section existed legitimately has no cases
  // to run - and a hard assertion here turned that into a red suite in every
  // SDK on the fleet, for a corpus the project had simply not re-pulled yet.
  //
  // The strict check belongs where the corpus is CONTROLLED, not where it is
  // consumed: sdkgen's own end-to-end lane generates against a corpus it
  // supplies and requires the cases to actually run, so a section that goes
  // missing there still fails loudly.
  test('the corpus carries a feature section', (t) => {
    if (null == corpus.feature) {
      return t.skip(
        'this project\'s test.json has no `feature` section - recompile the ' +
        'corpus (create-sdkgen .sdk/test/feature/) to run these cases')
    }
  })


  // At least one operation, or every case below would skip and the whole
  // suite would report green having run nothing.
  test('this SDK has an operation the corpus can drive', () => {
    ok(0 < ops.length,
      'no declared operation completed against a plain 200 — the corpus ' +
      'cannot exercise a feature without one')
  })


  for (const name of FEATURES) {

    test(name, async (t) => {
      const section = corpus.feature?.[name]
      if (null == section) {
        return t.skip(`no corpus section for ${name}`)
      }

      const probe: any = makeClient({})
      if (!probe._rootctx.config.hasFeature(name)) {
        return t.skip(`this SDK was generated without the ${name} feature`)
      }

      const cases: any[] = section.basic?.set || []
      ok(0 < cases.length,
        `corpus section feature.${name} ran ZERO cases — a renamed section ` +
        `or an emptied fixture must fail loudly, not pass silently`)

      let ran = 0
      for (const raw of cases) {
        const need = tokensUsed(raw)
        if (ops.length < need) {
          t.diagnostic(`skip "${raw.name}": needs ${need} operations, this SDK offers ${ops.length}`)
          continue
        }

        const tokens: Record<string, string> = {}
        for (let i = 0; i < need; i++) { tokens['#OP' + (i + 1)] = ops[i].key }

        const kase = resolve(raw, tokens)
        const client = makeClient(kase)

        for (const step of (kase.op || [])) {
          const ref = byKey[step.op]
          ok(null != ref, `${kase.name}: no operation ${step.op}`)
          try {
            await client[ref.accessor]()[ref.op]({}, step.ctrl || {})
            ok(null == step.err,
              `${kase.name}: ${step.op} was expected to fail, and did not`)
          }
          catch (err: any) {
            if (null == step.err) { throw err }
            if ('string' === typeof step.err) {
              deepStrictEqual(err.code, step.err, `${kase.name}: wrong error code`)
            }
          }
        }

        subset(client[`_${name}`], kase.out, `${kase.name}: _${name}`)
        ran++
      }

      ok(0 < ran, `every feature.${name} case was skipped`)
      // Say how many ran. A partial run is legitimate (an SDK with one
      // operation skips the cases needing two) but it should be visible
      // rather than inferred from a green tick - and it is the one line
      // sdkgen's end-to-end lane reads, in the same wording, from every
      // language's runner.
      t.diagnostic(`feature.${name}: ran ${ran} of ${cases.length} ` +
        `case(s) against ${ops.length} operation(s)`)
    })
  }
})
