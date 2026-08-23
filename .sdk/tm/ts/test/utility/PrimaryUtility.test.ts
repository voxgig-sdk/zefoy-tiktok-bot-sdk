
import { test, describe, before } from 'node:test'
import { equal, deepStrictEqual, ok } from 'node:assert'
import assert from 'node:assert'

import {
  makeRunner,
} from '../runner'

import {
  SDK,
  TEST_JSON_FILE
} from './index'


describe('PrimaryUtility', async () => {

  let spec: any
  let runset: any
  let runsetflags: any
  let client: any
  let utility: any
  let struct: any


  // Ensure ctx has options derived from client when needed.
  function fixctx(ctx: any) {
    if (ctx && ctx.client && null == ctx.options) {
      ctx.options = ctx.client.options()
    }
  }


  // Sections deliberately left empty in the shared corpus
  // (.sdk/test/primary/<name>.aon carries a PENDING header). Everything
  // else MUST contribute cases.
  const PENDING = new Set([
    'fetcher', 'makeFetchDef', 'makeResult',
    'featureAdd', 'featureHook', 'featureInit',
  ])

  // Run one corpus section, failing loudly when it would run ZERO cases.
  // A renamed section or a fixture that compiled to an empty `set` used to
  // pass silently, which defeats the point of a shared oracle. (The guard
  // lives here rather than in runner.ts, which is vendored verbatim from
  // @voxgig/struct and must stay byte-identical to upstream.)
  //
  // EVERY corpus-backed test goes through here — a guard that only some
  // sections opt into leaves the rest able to run zero assertions, which is
  // the exact hole it was added to close.
  async function runsection(name: string, subject: Function) {
    const section = spec[name]
    ok(null != section,
      `test corpus section '${name}' missing — check the name against .sdk/test/primary/`)
    ok(null != section.basic && Array.isArray(section.basic.set),
      `test corpus section '${name}' has no basic.set list`)
    if (0 === section.basic.set.length && !PENDING.has(name)) {
      throw new Error(
        `test corpus section '${name}' is EMPTY — zero cases would run; ` +
        `add cases, or mark the fixture PENDING in .sdk/test/primary/`)
    }
    return runset(section.basic, subject)
  }


  before(async () => {
    const runner = await makeRunner(TEST_JSON_FILE, await SDK.test())
    const run = await runner('primary')

    spec = run.spec
    runset = run.runset
    runsetflags = run.runsetflags
    client = run.client
    utility = client.utility()
    struct = utility.struct
  })


  test('exists', () => {
    const fns = [
      'clean', 'done', 'makeError', 'featureAdd', 'featureHook', 'featureInit',
      'fetcher', 'makeFetchDef', 'makeContext', 'makeOptions', 'makeRequest',
      'makeResponse', 'makeResult', 'makePoint', 'makeSpec', 'makeUrl',
      'param', 'prepareAuth', 'prepareBody', 'prepareHeaders', 'prepareMethod',
      'prepareParams', 'preparePath', 'prepareQuery', 'resultBasic',
      'resultBody', 'resultHeaders', 'transformRequest', 'transformResponse',
    ]

    for (const fn of fns) {
      equal('function', typeof utility[fn], fn + ' should be a function')
    }
  })


  test('context-basic', async () => {
    await runsection('makeContext', utility.makeContext)
  })


  test('method-basic', async () => {
    await runsection('prepareMethod', utility.prepareMethod)
  })


  test('headers-basic', async () => {
    await runsection('prepareHeaders', utility.prepareHeaders)
  })


  test('auth-basic', async () => {
    const sdkopts = spec.prepareAuth?.DEF?.setup?.a || {}
    const authClient = SDK.test({}, sdkopts)
    await runsection('prepareAuth', (ctx: any) => {
      ctx.client = authClient
      fixctx(ctx)
      return utility.prepareAuth(ctx)
    })
  })


  test('params-basic', async () => {
    await runsection('prepareParams', utility.prepareParams)
  })


  test('query-basic', async () => {
    await runsection('prepareQuery', utility.prepareQuery)
  })


  test('body-basic', async () => {
    await runsection('prepareBody', (ctx: any) => {
      fixctx(ctx)
      return utility.prepareBody(ctx)
    })
  })


  test('findparam-basic', async () => {
    await runsection('param', utility.param)
  })


  test('fullurl-basic', async () => {
    await runsection('makeUrl', utility.makeUrl)
  })


  test('operator-basic', async () => {
    await runsection('operator', (opmap: any) => ({
      entity: opmap.entity || '_',
      name: opmap.name || '_',
      input: opmap.input || '_',
      points: opmap.points || [],
    }))
  })


  test('options-basic', async () => {
    await runsection('makeOptions', (vin: any) => {
      const ctx = utility.makeContext({ options: vin.options, config: vin.config })
      ctx.client = client
      ctx.utility = utility
      return utility.makeOptions(ctx)
    })
  })


  test('spec-basic', async () => {
    const sdkopts = spec.makeSpec?.DEF?.setup?.a || {}
    const specClient = SDK.test({}, sdkopts)
    await runsection('makeSpec', (ctx: any) => {
      ctx.client = specClient
      ctx.options = specClient.options()
      return utility.makeSpec(ctx)
    })
  })


  test('reqform-basic', async () => {
    await runsection('transformRequest', utility.transformRequest)
  })


  test('resform-basic', async () => {
    await runsection('transformResponse', utility.transformResponse)
  })


  test('resbasic-basic', async () => {
    await runsection('resultBasic', (ctx: any) => {
      fixctx(ctx)
      return utility.resultBasic(ctx)
    })
  })


  test('resheaders-basic', async () => {
    await runsection('resultHeaders', (ctx: any) => {
      // Convert plain headers map to forEach-based (browser Response API)
      if (ctx.response?.headers && !ctx.response.headers.forEach) {
        const h = ctx.response.headers
        ctx.response.headers = {
          forEach: (cb: any) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
        }
      }
      return utility.resultHeaders(ctx)
    })
  })


  test('resbody-basic', async () => {
    await runsection('resultBody', async (ctx: any) => {
      if (ctx.response && !ctx.response.json) {
        const body = ctx.response.body
        ctx.response.json = async () => body
      }
      return utility.resultBody(ctx)
    })
  })


  test('request-basic', async () => {
    const mockFetch = async (url: string, init: any) => ({
      status: 200,
      statusText: 'OK',
      headers: { forEach: (cb: any) => { cb('application/json', 'content-type', {}) } },
      json: async () => ({ id: 'res01' }),
      body: 'present',
    })
    const reqClient = new (SDK as any)({
      // Concrete base: a live construction must satisfy any server variables a templated base URL declares; a literal base sidesteps the requirement.
      base: 'http://localhost:8080',
      system: { fetch: mockFetch }
    })
    const reqUtility = reqClient.utility()
    await runsection('makeRequest', async (ctx: any) => {
      ctx.client = reqClient
      ctx.utility = reqUtility
      ctx.options = reqClient.options()
      return reqUtility.makeRequest(ctx)
    })
  })


  test('response-basic', async () => {
    await runsection('makeResponse', async (ctx: any) => {
      fixctx(ctx)
      // Add json() and forEach to response for proper TS handling
      if (ctx.response && !ctx.response.json) {
        const body = ctx.response.body
        ctx.response.json = async () => body
      }
      if (ctx.response?.headers && !ctx.response.headers.forEach) {
        const h = ctx.response.headers
        ctx.response.headers = {
          forEach: (cb: any) => Object.entries(h).forEach(([k, v]) => cb(v, k.toLowerCase()))
        }
      }
      return utility.makeResponse(ctx)
    })
  })


  test('done-basic', async () => {
    await runsection('done', (ctx: any) => {
      fixctx(ctx)
      return utility.done(ctx)
    })
  })


  test('error-basic', async () => {
    await runsection('makeError', (...args: any[]) => {
      const ctx = args[0]
      fixctx(ctx)
      return utility.makeError(...args)
    })
  })


  // Was one hand-written case (the single-point path) covering one of this
  // utility's seven branches, which is how the corpus fixture came to be
  // marked deferred as "needs a real client". It does not: Context rebuilds
  // `op` from opname + entity + config, and `options` can be supplied
  // literally, so allow.op, the empty-points error, exist-selection,
  // $action selection and the invalid-$action error are all expressible.
  // Driven from the corpus now, so every port asserts the same branches.
  test('makePoint-basic', async () => {
    await runsection('makePoint', utility.makePoint)
  })


  test('makeFetchDef', () => {
    const ctx = makeFullCtx()
    ctx.spec = {
      base: 'http://localhost:8080',
      prefix: '/api',
      path: 'items/{id}',
      suffix: '',
      params: { id: 'item01' },
      query: {},
      headers: { 'content-type': 'application/json' },
      method: 'GET',
      step: 'start',
      body: undefined,
    } as any

    const fetchdef = utility.makeFetchDef(ctx)
    ok(!(fetchdef instanceof Error), 'should not be error')
    equal(fetchdef.method, 'GET')
    ok(fetchdef.url.includes('/api/items/item01'))
    equal(fetchdef.headers['content-type'], 'application/json')
    ok(null == fetchdef.body)
  })


  test('makeFetchDef-with-body', () => {
    const ctx = makeFullCtx()
    ctx.spec = {
      base: 'http://localhost:8080',
      prefix: '',
      path: 'items',
      suffix: '',
      params: {},
      query: {},
      headers: {},
      method: 'POST',
      step: 'start',
      body: { name: 'test' },
    } as any

    const fetchdef = utility.makeFetchDef(ctx)
    ok(!(fetchdef instanceof Error))
    equal(fetchdef.method, 'POST')
    equal(fetchdef.body, JSON.stringify({ name: 'test' }, null, 2))
  })


  test('featureAdd', () => {
    const ctx = makeCtx()
    const startLen = client._features.length

    const feature = {
      version: '0.0.1',
      name: 'testfeat',
      active: true,
      init: () => { },
    }

    utility.featureAdd(ctx, feature)
    equal(client._features.length, startLen + 1)
    equal(client._features[client._features.length - 1].name, 'testfeat')
  })


  test('featureHook', () => {
    const ctx = makeCtx()

    let called = false
    client._features = [{
      name: 'hookfeat',
      TestHook: () => { called = true },
    }]

    utility.featureHook(ctx, 'TestHook')
    equal(called, true)
  })


  test('featureInit', () => {
    const ctx = makeCtx()

    let initCalled = false
    const feature: any = {
      name: 'initfeat',
      active: true,
      init: () => { initCalled = true },
    }

    ctx.options.feature.initfeat = { active: true }

    utility.featureInit(ctx, feature)
    equal(initCalled, true)
  })


  test('featureInit-inactive', () => {
    const ctx = makeCtx()

    let initCalled = false
    const feature: any = {
      name: 'nofeat',
      active: false,
      init: () => { initCalled = true },
    }

    ctx.options.feature.nofeat = { active: false }

    utility.featureInit(ctx, feature)
    equal(initCalled, false)
  })


  test('fetcher-live', async () => {
    const calls: any[] = []
    const liveClient = new (SDK as any)({
      base: 'http://localhost:8080',
      system: {
        fetch: async (url: string, init: any) => {
          calls.push({ url, init })
          return { status: 200, statusText: 'OK' }
        }
      }
    })
    const liveUtility = liveClient.utility()
    const ctx = liveUtility.makeContext({ opname: 'load' }, liveClient._rootctx)
    ctx.client = liveClient

    const fetchdef = { method: 'GET', headers: {} }
    const response = await liveUtility.fetcher(ctx, 'http://example.com/test', fetchdef)
    ok(!(response instanceof Error))
    equal(calls.length, 1)
    equal(calls[0].url, 'http://example.com/test')
  })


  test('fetcher-blocked-test-mode', async () => {
    const blockedClient = new (SDK as any)({
      base: 'http://localhost:8080',
      system: { fetch: async () => ({}) }
    })
    blockedClient._mode = 'test'

    const blockedUtility = blockedClient.utility()
    const ctx = blockedUtility.makeContext({ opname: 'load' }, blockedClient._rootctx)
    ctx.client = blockedClient
    const fetchdef = { method: 'GET', headers: {} }

    const result = await blockedUtility.fetcher(ctx, 'http://example.com/test', fetchdef)
    ok(result instanceof Error)
    ok((result as Error).message.includes('mode'))
  })


  test('makeError-no-throw', () => {
    const ctx = makeFullCtx()
    ctx.ctrl.throw = false
    ctx.result = { ok: false, resdata: { id: 'safe01' } } as any

    const out = utility.makeError(ctx, ctx.error('test_code', 'test message'))
    deepStrictEqual(out, { id: 'safe01' })
  })


  test('path-basic', async () => {
    // preparePath shipped as an empty `set: []` — every port "passed" it while
    // running zero cases. Now corpus-driven like every other section.
    await runsection('preparePath', (ctx: any) => utility.preparePath(ctx))
  })


  test('clean-corpus', async () => {
    await runsection('clean', (...args: any[]) => utility.clean(args[0], args[1]))
  })


  test('clean', () => {
    const ctx = makeFullCtx()
    const val = { key: 'secret123', name: 'test' }
    const cleaned = utility.clean(ctx, val)
    ok(null != cleaned)
  })


  // Helper functions for manual tests
  function makeCtx(overrides?: any) {
    return utility.makeContext({
      opname: 'load',
      ...overrides,
    }, client._rootctx)
  }


  function makeFullCtx(overrides?: any) {
    const ctx = makeCtx(overrides)
    ctx.point = {
      parts: ['items', '{id}'],
      args: { params: [{ name: 'id', reqd: true }] },
      params: ['id'],
      alias: {},
      select: {},
      active: true,
      relations: [],
      transform: { req: undefined, res: undefined },
    }
    ctx.match = { id: 'item01' }
    ctx.reqmatch = { id: 'item01' }
    return ctx
  }

})
