
// Direct unit tests for the operation-pipeline utilities. The generated
// entity tests exercise the happy path; these drive the error and edge
// branches (missing spec/response/result, 4xx handling, transport
// failures, feature ordering, auth header shaping) that a normal
// success-path op never reaches. All utilities are reached through
// `stdutil`, so this suite is API-agnostic.

import { test, describe } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'

import { stdutil } from '..'


const struct: any = (stdutil as any).struct


function err(code: string, msg: string): any {
  const e: any = new Error(msg)
  e.code = code
  return e
}

// Transport-shaped response with a re-readable body + header iterator.
function resp(status: number, data?: any, headers?: Record<string, any>): any {
  const h: Record<string, any> = {}
  for (const k of Object.keys(headers || {})) { h[k.toLowerCase()] = (headers as any)[k] }
  return {
    status,
    statusText: status < 400 ? 'OK' : 'ERR',
    body: 'body',
    json: async () => data,
    headers: {
      get: (k: string) => h[String(k).toLowerCase()],
      forEach: (cb: any) => Object.keys(h).forEach((k) => cb(h[k], k)),
    },
  }
}

function base(over?: any): any {
  return {
    utility: stdutil,
    error: err,
    ctrl: {},
    out: {},
    op: { name: 'load', entity: 'x' },
    ...over,
  }
}

// A utility view whose fetcher is overridden (for makeRequest tests).
function utilWith(fetcher: any): any {
  return Object.assign(Object.create(stdutil), { fetcher })
}


describe('pipeline:makePoint + makeSpec', () => {

  const allow = { op: 'load,list,create,update,remove', method: 'GET,PUT,POST,PATCH,DELETE' }

  test('makePoint rejects a disallowed operation', () => {
    const ctx = base({ op: { name: 'nope', points: [] }, options: { allow: { op: 'load' } } })
    strictEqual((stdutil as any).makePoint(ctx).code, 'point_op_allow')
  })

  test('makePoint rejects an operation with no endpoints', () => {
    const ctx = base({ op: { name: 'load', points: [] }, options: { allow } })
    strictEqual((stdutil as any).makePoint(ctx).code, 'point_no_points')
  })

  test('makePoint returns the single point', () => {
    const point = { method: 'GET', parts: ['a'] }
    const ctx = base({ op: { name: 'load', points: [point] }, options: { allow } })
    strictEqual((stdutil as any).makePoint(ctx), point)
  })

  test('makePoint short-circuits a feature-supplied point', () => {
    const preset = { method: 'GET' }
    strictEqual((stdutil as any).makePoint(base({ out: { point: preset } })), preset)
  })

  test('makeSpec short-circuits a feature-supplied spec', () => {
    const preset = { method: 'GET' }
    strictEqual((stdutil as any).makeSpec(base({ out: { spec: preset } })), preset)
  })
})


describe('pipeline:makeResponse', () => {

  test('guards missing spec / response / result', async () => {
    const u = stdutil as any
    strictEqual((await u.makeResponse(base({ spec: null, response: {}, result: {} }))).code, 'response_no_spec')
    strictEqual((await u.makeResponse(base({ spec: {}, response: null, result: {} }))).code, 'response_no_response')
    strictEqual((await u.makeResponse(base({ spec: {}, response: {}, result: null }))).code, 'response_no_result')
  })

  test('a 4xx response sets result.err and copies headers', async () => {
    const ctx = base({ spec: { step: 's' }, response: resp(404, undefined, { 'x-a': '1' }), result: { ok: false } })
    await (stdutil as any).makeResponse(ctx)
    ok(null != ctx.result.err)
    strictEqual(ctx.result.status, 404)
    strictEqual(ctx.result.headers['x-a'], '1')
  })

  test('a 2xx response parses the body and marks ok', async () => {
    const ctx = base({ spec: { step: 's' }, response: resp(200, { v: 1 }), result: { ok: false } })
    await (stdutil as any).makeResponse(ctx)
    strictEqual(ctx.result.ok, true)
    deepStrictEqual(ctx.result.body, { v: 1 })
  })

  test('records to ctrl.explain when explain is on', async () => {
    const ctx = base({ ctrl: { explain: {} }, spec: { step: 's' }, response: resp(200, { v: 2 }), result: { ok: false } })
    await (stdutil as any).makeResponse(ctx)
    ok(null != ctx.ctrl.explain.result)
  })

  test('a body-parse exception is captured on result.err', async () => {
    const throwing = resp(200, undefined)
    throwing.json = async () => { throw new Error('bad json') }
    const ctx = base({ spec: { step: 's' }, response: throwing, result: { ok: false } })
    await (stdutil as any).makeResponse(ctx)
    ok(null != ctx.result.err)
  })

  test('short-circuits when a feature already supplied the response', async () => {
    const preset = resp(299)
    const ctx = base({ out: { response: preset }, spec: {}, response: {}, result: {} })
    strictEqual(await (stdutil as any).makeResponse(ctx), preset)
  })
})


describe('pipeline:makeResult', () => {

  test('guards missing spec / result', () => {
    const u = stdutil as any
    strictEqual(u.makeResult(base({ spec: null, result: {} })).code, 'result_no_spec')
    strictEqual(u.makeResult(base({ spec: {}, result: null })).code, 'result_no_result')
  })

  test('list op wraps resdata into entity instances', () => {
    const made: any[] = []
    const entity = { make: () => ({ data: (d: any) => made.push(d) }) }
    const ctx = base({
      op: { name: 'list', entity: 'x' }, entity,
      spec: { step: 's' }, result: { resdata: [{ a: 1 }, { a: 2 }] },
    })
    const r = (stdutil as any).makeResult(ctx)
    strictEqual(r.resdata.length, 2)
    strictEqual(made.length, 2)
  })

  test('an empty list yields an empty resdata array', () => {
    const ctx = base({ op: { name: 'list', entity: 'x' }, entity: { make: () => ({ data: () => { } }) }, spec: { step: 's' }, result: { resdata: [] } })
    const r = (stdutil as any).makeResult(ctx)
    deepStrictEqual(r.resdata, [])
  })

  test('short-circuits on a preset result', () => {
    const preset = { ok: true }
    strictEqual((stdutil as any).makeResult(base({ out: { result: preset }, spec: {}, result: {} })), preset)
  })
})


describe('pipeline:makeRequest', () => {

  test('guards a missing spec', async () => {
    strictEqual((await (stdutil as any).makeRequest(base({ spec: null }))).code, 'request_no_spec')
  })

  test('a null transport result becomes a response error', async () => {
    const ctx = base({ utility: utilWith(async () => null), spec: { step: 's', method: 'GET', headers: {} } })
    const r = await (stdutil as any).makeRequest(ctx)
    ok(null != r.err)
  })

  test('an Error transport result is carried on the response', async () => {
    const boom = err('boom', 'boom')
    const ctx = base({ utility: utilWith(async () => boom), spec: { step: 's', method: 'GET', headers: {} } })
    const r = await (stdutil as any).makeRequest(ctx)
    strictEqual(r.err, boom)
  })

  test('a normal transport response is wrapped', async () => {
    const ctx = base({ utility: utilWith(async () => resp(200, { a: 1 })), spec: { step: 's', method: 'GET', headers: {} } })
    const r = await (stdutil as any).makeRequest(ctx)
    strictEqual(r.status, 200)
  })

  test('records the fetchdef to ctrl.explain', async () => {
    const ctx = base({
      ctrl: { explain: {} },
      utility: utilWith(async () => resp(200, {})),
      spec: { step: 's', method: 'GET', headers: {} },
    })
    await (stdutil as any).makeRequest(ctx)
    ok(null != ctx.ctrl.explain.fetchdef)
  })

  test('a fetchdef error surfaces as a response error', async () => {
    const u = Object.assign(Object.create(stdutil), {
      makeFetchDef: () => err('fetchdef_boom', 'boom'),
    })
    const ctx = base({ utility: u, spec: { step: 's', method: 'GET', headers: {} } })
    const r = await (stdutil as any).makeRequest(ctx)
    ok(null != r.err)
  })

  test('short-circuits a feature-supplied request', async () => {
    const preset = resp(201)
    strictEqual(await (stdutil as any).makeRequest(base({ out: { request: preset }, spec: {} })), preset)
  })
})


describe('pipeline:makeFetchDef', () => {

  test('guards a missing spec', () => {
    strictEqual((stdutil as any).makeFetchDef(base({ spec: null })).code, 'fetchdef_no_spec')
  })

  test('serialises an object body to JSON and inits a missing result', () => {
    const ctx = base({
      result: null,
      spec: { step: 's', method: 'POST', headers: {}, base: 'http://h', prefix: '', suffix: '', parts: ['a'], body: { x: 1 } },
    })
    const fd = (stdutil as any).makeFetchDef(ctx)
    strictEqual(typeof fd.body, 'string')
    ok(fd.url.includes('http://h'))
    ok(null != ctx.result) // result was lazily created
  })
})


describe('pipeline:makeError + done', () => {

  test('done returns resdata on success', () => {
    strictEqual((stdutil as any).done(base({ result: { ok: true, resdata: 42 } })), 42)
  })

  test('done throws the error when not ok', () => {
    let threw = false
    try { (stdutil as any).done(base({ result: { ok: false } })) }
    catch (e: any) { threw = true }
    strictEqual(threw, true)
  })

  test('done cleans ctrl.explain on success', () => {
    const ctx = base({ ctrl: { explain: { result: { err: 'x' } } }, result: { ok: true, resdata: 7 } })
    strictEqual((stdutil as any).done(ctx), 7)
  })

  test('makeError returns resdata instead of throwing when ctrl.throw is false', () => {
    const ctx = base({ ctrl: { throw: false }, result: { ok: false, resdata: 'fallback' } })
    strictEqual((stdutil as any).makeError(ctx), 'fallback')
  })

  test('makeError records to ctrl.explain', () => {
    const ctx = base({ ctrl: { throw: false, explain: {} }, result: { ok: false } })
    ;(stdutil as any).makeError(ctx)
    ok(null != ctx.ctrl.explain.err)
  })
})


describe('pipeline:featureAdd ordering', () => {

  function client() { return { _features: [{ name: 'a' }, { name: 'b' }] } as any }

  test('appends by default', () => {
    const c = client()
    ;(stdutil as any).featureAdd({ client: c, utility: stdutil }, { name: 'z', _options: {} })
    strictEqual(c._features.map((f: any) => f.name).join(','), 'a,b,z')
  })

  test('__before__ inserts ahead of the named feature', () => {
    const c = client()
    ;(stdutil as any).featureAdd({ client: c, utility: stdutil }, { name: 'z', _options: { __before__: 'b' } })
    strictEqual(c._features.map((f: any) => f.name).join(','), 'a,z,b')
  })

  test('__after__ inserts behind the named feature', () => {
    const c = client()
    ;(stdutil as any).featureAdd({ client: c, utility: stdutil }, { name: 'z', _options: { __after__: 'a' } })
    strictEqual(c._features.map((f: any) => f.name).join(','), 'a,z,b')
  })

  test('__replace__ swaps the named feature', () => {
    const c = client()
    ;(stdutil as any).featureAdd({ client: c, utility: stdutil }, { name: 'z', _options: { __replace__: 'a' } })
    strictEqual(c._features.map((f: any) => f.name).join(','), 'z,b')
  })
})


describe('pipeline:feature order', () => {

  function resolve(feature: any) {
    const ctx = { utility: stdutil, options: { feature }, config: { options: {} } } as any
    return (stdutil as any).makeOptions(ctx)
  }

  test('map form is ordered test-first (test is the base transport)', () => {
    const o = resolve({ metrics: { active: true }, test: { active: true } })
    strictEqual(o.__derived__.featureorder.join(','), 'test,metrics')
  })

  test('array form preserves the explicit developer-specified order', () => {
    const o = resolve([{ name: 'metrics', active: true }, { name: 'test', active: true }])
    strictEqual(o.__derived__.featureorder.join(','), 'metrics,test')
    // the array is normalized to a map for merge/init, opts preserved
    strictEqual(o.feature.metrics.active, true)
    strictEqual(o.feature.test.active, true)
  })

  test('map form with no test orders names deterministically', () => {
    const o = resolve({ retry: { active: true }, cache: { active: true } })
    strictEqual(o.__derived__.featureorder.join(','), 'cache,retry')
  })
})


describe('pipeline:prepareAuth', () => {

  // Fake client so the exact options.auth / apikey shape is controlled.
  function authCtx(options: any, headers: any) {
    return base({ client: { options: () => options }, spec: headers == null ? null : { headers } })
  }

  test('guards a missing spec', () => {
    strictEqual((stdutil as any).prepareAuth(authCtx({ auth: { prefix: '' }, apikey: 'K' }, null)).code, 'auth_no_spec')
  })

  test('an apikey with a prefix is space-joined', () => {
    const ctx = authCtx({ apikey: 'K', auth: { prefix: 'Bearer' } }, {})
    ;(stdutil as any).prepareAuth(ctx)
    strictEqual(ctx.spec.headers.authorization, 'Bearer K')
  })

  test('a raw apikey (empty prefix) goes in as-is', () => {
    const ctx = authCtx({ apikey: 'K', auth: { prefix: '' } }, {})
    ;(stdutil as any).prepareAuth(ctx)
    strictEqual(ctx.spec.headers.authorization, 'K')
  })

  test('an empty apikey drops the header', () => {
    const ctx = authCtx({ apikey: '', auth: { prefix: 'Bearer' } }, { authorization: 'stale' })
    ;(stdutil as any).prepareAuth(ctx)
    strictEqual(ctx.spec.headers.authorization, undefined)
  })

  test('a public API (no auth block) drops the header', () => {
    const ctx = authCtx({ apikey: 'K' }, { authorization: 'stale' })
    ;(stdutil as any).prepareAuth(ctx)
    strictEqual(ctx.spec.headers.authorization, undefined)
  })

  test('a missing apikey option drops the header', () => {
    const ctx = authCtx({ auth: { prefix: 'Bearer' } }, { authorization: 'stale' })
    ;(stdutil as any).prepareAuth(ctx)
    strictEqual(ctx.spec.headers.authorization, undefined)
  })
})


describe('pipeline:result helpers', () => {

  test('resultHeaders with no forEach yields an empty map', () => {
    const ctx = base({ response: { headers: {} }, result: {} })
    ;(stdutil as any).resultHeaders(ctx)
    deepStrictEqual(ctx.result.headers, {})
  })

  test('resultBody skips parsing when the body is absent', async () => {
    const ctx = base({ response: { json: async () => ({ a: 1 }), body: null }, result: {} })
    await (stdutil as any).resultBody(ctx)
    strictEqual(ctx.result.body, undefined)
  })
})
