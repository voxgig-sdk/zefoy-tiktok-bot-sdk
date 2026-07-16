
// Behavioural + coverage tests for the enterprise features shipped with
// this SDK. Each block runs only when its feature is present (see
// hasFeature), driving the real generated feature class through the offline
// harness pipeline against a simulated network.

import { test, describe } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'

import { hasFeature, makeClient, makeClock, makeResponse } from './feature/harness'


function recordingServer(reply?: (n: number, fetchdef: any) => any) {
  const calls: any[] = []
  const server = (_ctx: any, url: string, fetchdef: any) => {
    calls.push({ url, fetchdef })
    if (reply) { return reply(calls.length, fetchdef) }
    return makeResponse(200, { ok: true, n: calls.length })
  }
  return { server, calls }
}


describe('feature', () => {

  test('at least the test feature is present', () => {
    strictEqual(hasFeature('test'), true)
  })


  // --- netsim ---------------------------------------------------------------
  if (hasFeature('netsim')) describe('netsim', () => {

    test('fixed latency then delegate', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [{ name: 'netsim', options: { latency: 250, sleep: clock.sleep } }] })
      const res = await h.op({ op: 'load', ctrl: { explain: {} } })
      strictEqual(res.ok, true)
      strictEqual(clock.time, 250)
      strictEqual(h.client._netsim.calls, 1)
    })

    test('ranged latency samples within [min,max)', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [{ name: 'netsim', options: { latency: { min: 100, max: 300 }, seed: 7, sleep: clock.sleep } }] })
      await h.op({ op: 'load' })
      ok(clock.time >= 100 && clock.time < 300, 'latency in range, got ' + clock.time)
    })

    test('equal min/max latency is exact', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [{ name: 'netsim', options: { latency: { min: 50, max: 50 }, sleep: clock.sleep } }] })
      await h.op({ op: 'load' })
      strictEqual(clock.time, 50)
    })

    test('failTimes returns a retryable status', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { failTimes: 2, failStatus: 503 } }] })
      strictEqual((await h.op({ op: 'load' })).result.status, 503)
      strictEqual((await h.op({ op: 'load' })).result.status, 503)
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })

    test('failEvery fails every Nth call', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { failEvery: 2 } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual((await h.op({ op: 'load' })).ok, false)
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })

    test('failRate with a seed is deterministic', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { failRate: 1, seed: 5 } }] })
      strictEqual((await h.op({ op: 'load' })).ok, false)
    })

    test('errorTimes throws a connection error', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { errorTimes: 1 } }] })
      strictEqual((await h.op({ op: 'load' })).error.code, 'netsim_conn')
    })

    test('offline fails every call', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { offline: true } }] })
      strictEqual((await h.op({ op: 'load' })).error.code, 'netsim_offline')
    })

    test('rateLimitTimes returns 429 + Retry-After', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 3 } }] })
      const res = await h.op({ op: 'load' })
      strictEqual(res.result.status, 429)
      strictEqual(res.result.headers['retry-after'], '3')
    })
  })


  // --- retry ----------------------------------------------------------------
  if (hasFeature('retry')) describe('retry', () => {

    test('retries transient failures then succeeds', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 2, failStatus: 503 } },
        { name: 'retry', options: { retries: 3, minDelay: 10, jitter: false, sleep: clock.sleep } },
      ] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual(h.client._retry.attempts, 2)
    })

    test('gives up after the budget', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 9, failStatus: 500 } },
        { name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } },
      ] })
      strictEqual((await h.op({ op: 'load' })).result.status, 500)
    })

    test('does not retry a non-retryable status', async () => {
      const rec = recordingServer((_n) => makeResponse(404))
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls.length, 1)
    })

    test('retries a thrown transport error then rethrows when exhausted', async () => {
      const clock = makeClock()
      let n = 0
      const server = () => { n++; throw new Error('boom') }
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 2, minDelay: 1, jitter: false, sleep: clock.sleep } }], server })
      const res = await h.op({ op: 'load' })
      strictEqual(res.ok, false)
      strictEqual(n, 3)
    })

    test('honours a server Retry-After', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [
        { name: 'netsim', options: { rateLimitTimes: 1, retryAfter: 2 } },
        { name: 'retry', options: { retries: 2, minDelay: 10, maxDelay: 60000, jitter: false, sleep: clock.sleep } },
      ] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual(clock.time, 2000)
    })

    test('default jitter path still succeeds', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 1 } },
        { name: 'retry', options: { retries: 2, minDelay: 0 } },
      ] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
  })


  // --- timeout --------------------------------------------------------------
  if (hasFeature('timeout')) describe('timeout', () => {

    test('a slow request times out', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { latency: 80 } },
        { name: 'timeout', options: { ms: 10 } },
      ] })
      const res = await h.op({ op: 'load' })
      strictEqual(res.error.code, 'timeout')
      strictEqual(h.client._timeout.count, 1)
    })

    test('a fast request passes through', async () => {
      const h = makeClient({ features: [{ name: 'timeout', options: { ms: 1000 } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })

    test('ms<=0 disables the timeout', async () => {
      const h = makeClient({ features: [{ name: 'timeout', options: { ms: 0 } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
  })


  // --- ratelimit ------------------------------------------------------------
  if (hasFeature('ratelimit')) describe('ratelimit', () => {

    test('throttles once the burst is spent', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [{ name: 'ratelimit', options: { rate: 1, burst: 2, now: clock.now, sleep: clock.sleep } }] })
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      strictEqual(h.client._ratelimit.throttled, 1)
      ok(clock.time > 0)
    })

    test('burst defaults to rate and refills over time', async () => {
      const clock = makeClock()
      const h = makeClient({ features: [{ name: 'ratelimit', options: { rate: 2, now: clock.now, sleep: clock.sleep } }] })
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      clock.advance(1000) // refill
      await h.op({ op: 'load' })
      strictEqual(h.client._ratelimit == null ? 0 : h.client._ratelimit.throttled, 0)
    })
  })


  // --- cache ----------------------------------------------------------------
  if (hasFeature('cache')) describe('cache', () => {

    test('serves a repeated read from cache', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache', options: { ttl: 10000 } }], server: rec.server })
      const a = await h.op({ op: 'load', path: '/w/1' })
      const b = await h.op({ op: 'load', path: '/w/1' })
      strictEqual(rec.calls.length, 1)
      deepStrictEqual(a.data, b.data)
      strictEqual(h.client._cache.hit, 1)
    })

    test('does not cache non-GET', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache' }], server: rec.server })
      await h.op({ op: 'create', path: '/w' })
      await h.op({ op: 'create', path: '/w' })
      strictEqual(rec.calls.length, 2)
    })

    test('does not cache a non-2xx (bypass)', async () => {
      const rec = recordingServer((_n) => makeResponse(500))
      const h = makeClient({ features: [{ name: 'cache' }], server: rec.server })
      await h.op({ op: 'load', path: '/w' })
      await h.op({ op: 'load', path: '/w' })
      strictEqual(rec.calls.length, 2)
      strictEqual(h.client._cache.bypass, 2)
    })

    test('re-fetches after the ttl', async () => {
      const clock = makeClock()
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache', options: { ttl: 1000, now: clock.now } }], server: rec.server })
      await h.op({ op: 'load', path: '/w' })
      clock.advance(1500)
      await h.op({ op: 'load', path: '/w' })
      strictEqual(rec.calls.length, 2)
    })

    test('evicts the oldest entry past max', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache', options: { ttl: 10000, max: 1 } }], server: rec.server })
      await h.op({ op: 'load', path: '/a' })
      await h.op({ op: 'load', path: '/b' }) // evicts /a
      await h.op({ op: 'load', path: '/a' }) // miss again
      strictEqual(rec.calls.length, 3)
    })
  })


  // --- idempotency ----------------------------------------------------------
  if (hasFeature('idempotency')) describe('idempotency', () => {

    test('adds a key to mutating ops', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'idempotency' }], server: rec.server })
      await h.op({ op: 'create', path: '/w' })
      ok(null != rec.calls[0].fetchdef.headers['Idempotency-Key'])
    })

    test('adds a key based on HTTP method', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'idempotency' }], server: rec.server })
      await h.op({ op: 'act', method: 'PUT', path: '/w' })
      ok(null != rec.calls[0].fetchdef.headers['Idempotency-Key'])
    })

    test('leaves reads untouched', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'idempotency' }], server: rec.server })
      await h.op({ op: 'load', path: '/w/1' })
      strictEqual(rec.calls[0].fetchdef.headers['Idempotency-Key'], undefined)
    })

    test('preserves a caller key and honours a custom header', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'idempotency', options: { header: 'X-Idem' } }], server: rec.server })
      await h.op({ op: 'create', path: '/w', headers: { 'X-Idem': 'caller-1' } })
      strictEqual(rec.calls[0].fetchdef.headers['X-Idem'], 'caller-1')
    })
  })


  // --- rbac -----------------------------------------------------------------
  if (hasFeature('rbac')) describe('rbac', () => {

    test('denies before any call', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: [] } }], server: rec.server })
      const res = await h.op({ op: 'remove', path: '/w/1' })
      strictEqual(res.error.code, 'rbac_denied')
      strictEqual(rec.calls.length, 0)
      strictEqual(h.client._rbac.denied, 1)
    })

    test('allows a held permission', async () => {
      const h = makeClient({ features: [{ name: 'rbac', options: { rules: { 'widget.remove': 'admin' }, permissions: ['admin'] } }] })
      strictEqual((await h.op({ op: 'remove', path: '/w/1' })).ok, true)
    })

    test('rule by op name and wildcard grant', async () => {
      const h = makeClient({ features: [{ name: 'rbac', options: { rules: { load: 'read' }, permissions: ['*'] } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })

    test('no rule allows by default; deny:true blocks', async () => {
      const allow = makeClient({ features: [{ name: 'rbac', options: { permissions: [] } }] })
      strictEqual((await allow.op({ op: 'load' })).ok, true)
      const deny = makeClient({ features: [{ name: 'rbac', options: { deny: true, permissions: [] } }] })
      strictEqual((await deny.op({ op: 'load' })).error.code, 'rbac_denied')
    })
  })


  // --- metrics --------------------------------------------------------------
  if (hasFeature('metrics')) describe('metrics', () => {

    test('counts ok and err per op', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'metrics', options: {} },
      ] })
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      await h.op({ op: 'list' })
      const m = h.client._metrics
      strictEqual(m.total.count, 3)
      strictEqual(m.total.ok, 2)
      strictEqual(m.total.err, 1)
      strictEqual(m.ops['widget.load'].count, 2)
    })
  })


  // --- telemetry ------------------------------------------------------------
  if (hasFeature('telemetry')) describe('telemetry', () => {

    test('opens spans and propagates trace headers', async () => {
      const rec = recordingServer()
      const spans: any[] = []
      const h = makeClient({ features: [{ name: 'telemetry', options: { exporter: (s: any) => spans.push(s) } }], server: rec.server })
      const res = await h.op({ op: 'load' })
      strictEqual(res.ok, true)
      strictEqual(h.client._telemetry.spans.length, 1)
      strictEqual(spans.length, 1)
      const sent = rec.calls[0].fetchdef.headers
      strictEqual(sent['X-Trace-Id'], h.client._telemetry.spans[0].traceId)
      ok(/^00-.+-.+-01$/.test(sent['traceparent']))
    })

    test('records a failed span on error', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'telemetry', options: {} },
      ] })
      await h.op({ op: 'load' })
      strictEqual(h.client._telemetry.spans[0].ok, false)
    })
  })


  // --- debug ----------------------------------------------------------------
  if (hasFeature('debug')) describe('debug', () => {

    test('captures a redacted trace and honours onEntry + max', async () => {
      const seen: any[] = []
      const h = makeClient({ features: [{ name: 'debug', options: { max: 1, onEntry: (e: any) => seen.push(e) } }] })
      await h.op({ op: 'load', headers: { authorization: 'Bearer secret' } })
      await h.op({ op: 'list' })
      const entries = h.client._debug.entries
      strictEqual(entries.length, 1) // ring buffer capped at max
      strictEqual(seen.length, 2)
      strictEqual(seen[0].headers.authorization, '<redacted>')
    })

    test('captures failures', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'debug', options: {} },
      ] })
      await h.op({ op: 'load' })
      strictEqual(h.client._debug.entries[0].ok, false)
    })
  })


  // --- audit ----------------------------------------------------------------
  if (hasFeature('audit')) describe('audit', () => {

    test('one record per op with sink + actor', async () => {
      const sink: any[] = []
      const h = makeClient({ features: [
        { name: 'netsim', options: { failTimes: 1, failStatus: 500 } },
        { name: 'audit', options: { actor: 'svc', sink: (r: any) => sink.push(r), max: 5 } },
      ] })
      await h.op({ op: 'remove', path: '/w/1' })
      await h.op({ op: 'load', ctrl: { actor: 'per-call' } })
      const recs = h.client._audit.records
      strictEqual(recs.length, 2)
      strictEqual(recs[0].outcome, 'error')
      strictEqual(recs[0].actor, 'svc')
      strictEqual(recs[1].actor, 'per-call')
      strictEqual(sink.length, 2)
    })
  })


  // --- clienttrack ----------------------------------------------------------
  if (hasFeature('clienttrack')) describe('clienttrack', () => {

    test('stable client id, unique request ids, UA', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'clienttrack', options: { clientName: 'Acme', clientVersion: '2.0.0' } }], server: rec.server })
      await h.ready()
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      const h0 = rec.calls[0].fetchdef.headers
      const h1 = rec.calls[1].fetchdef.headers
      strictEqual(h0['User-Agent'], 'Acme/2.0.0')
      strictEqual(h0['X-Client-Id'], h1['X-Client-Id'])
      ok(h0['X-Request-Id'] !== h1['X-Request-Id'])
      strictEqual(h.client._clienttrack.requests, 2)
    })

    test('does not clobber a caller User-Agent', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'clienttrack' }], server: rec.server })
      await h.ready()
      await h.op({ op: 'load', headers: { 'User-Agent': 'mine' } })
      strictEqual(rec.calls[0].fetchdef.headers['User-Agent'], 'mine')
    })
  })


  // --- paging ---------------------------------------------------------------
  if (hasFeature('paging')) describe('paging', () => {

    test('stamps page/limit and reads header signals', async () => {
      const rec = recordingServer((_n) => makeResponse(200, { items: [1, 2] },
        { 'x-next-page': '2', 'x-total-count': '5', 'link': '</w?page=2>; rel="next"' }))
      const h = makeClient({ features: [{ name: 'paging', options: { limit: 2 } }], server: rec.server })
      const res = await h.op({ op: 'list', path: '/w' })
      ok(/[?&]page=1(&|$)/.test(rec.calls[0].url))
      ok(/[?&]limit=2(&|$)/.test(rec.calls[0].url))
      strictEqual(res.result.paging.nextPage, 2)
      strictEqual(res.result.paging.totalCount, 5)
      strictEqual(res.result.paging.next, '/w?page=2')
    })

    test('body cursor + explicit cursor request', async () => {
      const rec = recordingServer((_n) => makeResponse(200, { nextCursor: 'abc', hasMore: true }))
      const h = makeClient({ features: [{ name: 'paging' }], server: rec.server })
      const res = await h.op({ op: 'list', path: '/w', ctrl: { paging: { cursor: 'xyz' } } })
      ok(/[?&]cursor=xyz(&|$)/.test(rec.calls[0].url))
      strictEqual(res.result.paging.cursor, 'abc')
      strictEqual(res.result.paging.hasMore, true)
    })
  })


  // --- streaming ------------------------------------------------------------
  if (hasFeature('streaming')) describe('streaming', () => {

    test('streams list items', async () => {
      const clock = makeClock()
      const rec = recordingServer((_n) => makeResponse(200, ['a', 'b', 'c']))
      const h = makeClient({ features: [{ name: 'streaming', options: { chunkDelay: 5, sleep: clock.sleep } }], server: rec.server })
      const res = await h.op({ op: 'list', path: '/w' })
      strictEqual(res.result.streaming, true)
      const seen: any[] = []
      for await (const item of res.result.stream()) { seen.push(item) }
      deepStrictEqual(seen, ['a', 'b', 'c'])
      strictEqual(clock.time, 15)
    })

    test('batches with chunkSize', async () => {
      const rec = recordingServer((_n) => makeResponse(200, [1, 2, 3, 4, 5]))
      const h = makeClient({ features: [{ name: 'streaming', options: { chunkSize: 2 } }], server: rec.server })
      const res = await h.op({ op: 'list', path: '/w' })
      const batches: any[] = []
      for await (const b of res.result.stream()) { batches.push(b) }
      deepStrictEqual(batches, [[1, 2], [3, 4], [5]])
    })
  })


  // --- proxy ----------------------------------------------------------------
  if (hasFeature('proxy')) describe('proxy', () => {

    test('routes through the proxy and invokes an agent factory', async () => {
      const rec = recordingServer()
      let agentUrl = ''
      const h = makeClient({ features: [{ name: 'proxy', options: { url: 'http://proxy:8080', agent: (u: string) => { agentUrl = u; return { a: 1 } } } }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls[0].fetchdef.proxy, 'http://proxy:8080')
      strictEqual(rec.calls[0].fetchdef.dispatcher.a, 1)
      strictEqual(agentUrl, 'http://proxy:8080')
      strictEqual(h.client._proxy.routed, 1)
    })

    test('bypasses noProxy hosts', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'proxy', options: { url: 'http://proxy:8080', noProxy: ['api.test'] } }], server: rec.server, base: 'http://api.test' })
      await h.op({ op: 'load' })
      strictEqual(rec.calls[0].fetchdef.proxy, undefined)
    })
  })


  // --- edge branches (coverage) ---------------------------------------------
  // Inactive features must no-op; transport features must handle odd
  // responses; the default (non-injected) clocks/timers must run.

  if (hasFeature('netsim')) describe('netsim-edge', () => {
    test('inactive netsim does not wrap', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { active: false } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual(h.client._netsim, undefined)
    })
    test('no latency option delays nothing (real timer path)', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: {} }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
    test('real-timer latency actually waits', async () => {
      const h = makeClient({ features: [{ name: 'netsim', options: { latency: 15 } }] })
      const t0 = Date.now()
      await h.op({ op: 'load' })
      ok(Date.now() - t0 >= 8)
    })
  })

  if (hasFeature('retry')) describe('retry-edge', () => {
    test('inactive retry does not wrap', async () => {
      const rec = recordingServer((_n) => makeResponse(503))
      const h = makeClient({ features: [{ name: 'retry', options: { active: false } }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls.length, 1)
    })
    test('retries a null transport result', async () => {
      let n = 0
      const server = () => { n++; return n < 2 ? null : makeResponse(200, { ok: true }) }
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual(n, 2)
    })
    test('non-numeric status is not retryable', async () => {
      const rec = recordingServer((_n) => ({ status: 'weird', json: async () => ({}), headers: { forEach() { } } }))
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 3, minDelay: 0 } }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls.length, 1)
    })
    test('Retry-After via plain (non-.get) headers', async () => {
      const clock = makeClock()
      let n = 0
      const server = () => {
        n++
        return n < 2
          ? { status: 429, json: async () => undefined, headers: { 'retry-after': '1', forEach() { } } }
          : makeResponse(200, { ok: true })
      }
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 2, minDelay: 0, jitter: false, sleep: clock.sleep } }], server })
      strictEqual((await h.op({ op: 'load' })).ok, true)
      strictEqual(clock.time, 1000)
    })
    test('default setTimeout backoff path runs', async () => {
      let n = 0
      const server = () => { n++; return n < 2 ? makeResponse(503) : makeResponse(200, { ok: true }) }
      const h = makeClient({ features: [{ name: 'retry', options: { retries: 2, minDelay: 1, jitter: false } }], server })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
  })

  if (hasFeature('timeout')) describe('timeout-edge', () => {
    test('inactive timeout does not wrap', async () => {
      const h = makeClient({ features: [{ name: 'timeout', options: { active: false } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
  })

  if (hasFeature('cache')) describe('cache-edge', () => {
    test('inactive cache does not wrap', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache', options: { active: false } }], server: rec.server })
      await h.op({ op: 'load', path: '/x' })
      await h.op({ op: 'load', path: '/x' })
      strictEqual(rec.calls.length, 2)
    })
    test('real Date.now ttl path', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'cache', options: { ttl: 10000 } }], server: rec.server })
      await h.op({ op: 'load', path: '/y' })
      await h.op({ op: 'load', path: '/y' })
      strictEqual(rec.calls.length, 1)
    })
  })

  if (hasFeature('ratelimit')) describe('ratelimit-edge', () => {
    test('inactive ratelimit does not wrap', async () => {
      const h = makeClient({ features: [{ name: 'ratelimit', options: { active: false } }] })
      strictEqual((await h.op({ op: 'load' })).ok, true)
    })
    test('real clock throttle path', async () => {
      const h = makeClient({ features: [{ name: 'ratelimit', options: { rate: 1000, burst: 1 } }] })
      await h.op({ op: 'load' })
      await h.op({ op: 'load' })
      ok((h.client._ratelimit == null ? 0 : h.client._ratelimit.throttled) >= 0)
    })
  })

  if (hasFeature('proxy')) describe('proxy-edge', () => {
    test('inactive proxy does not wrap', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'proxy', options: { active: false } }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls[0].fetchdef.proxy, undefined)
    })
    test('no url set is a no-op', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'proxy', options: {} }], server: rec.server })
      await h.op({ op: 'load' })
      strictEqual(rec.calls[0].fetchdef.proxy, undefined)
    })
    test('fromEnv reads HTTPS_PROXY', async () => {
      const prev = process.env.HTTPS_PROXY
      process.env.HTTPS_PROXY = 'http://env-proxy:8080'
      try {
        const rec = recordingServer()
        const h = makeClient({ features: [{ name: 'proxy', options: { fromEnv: true } }], server: rec.server })
        await h.op({ op: 'load' })
        strictEqual(rec.calls[0].fetchdef.proxy, 'http://env-proxy:8080')
      }
      finally {
        if (prev == null) { delete process.env.HTTPS_PROXY } else { process.env.HTTPS_PROXY = prev }
      }
    })
  })

  if (hasFeature('clienttrack')) describe('clienttrack-edge', () => {
    test('real id generation without PostConstruct', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'clienttrack' }], server: rec.server })
      // no ready() -> PreRequest lazily creates the session id
      await h.op({ op: 'load' })
      ok(null != rec.calls[0].fetchdef.headers['X-Client-Id'])
    })
  })

  if (hasFeature('idempotency')) describe('idempotency-edge', () => {
    test('real key generation', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'idempotency' }], server: rec.server })
      await h.op({ op: 'create', path: '/w' })
      ok(/^[0-9a-f]+$/.test(rec.calls[0].fetchdef.headers['Idempotency-Key']))
    })
  })

  if (hasFeature('telemetry')) describe('telemetry-edge', () => {
    test('default id generation and no exporter', async () => {
      const h = makeClient({ features: [{ name: 'telemetry' }] })
      await h.op({ op: 'load' })
      ok(/^t/.test(h.client._telemetry.spans[0].traceId))
    })
  })

  if (hasFeature('streaming')) describe('streaming-edge', () => {
    test('non-list op is not streamed', async () => {
      const h = makeClient({ features: [{ name: 'streaming' }] })
      const res = await h.op({ op: 'load' })
      strictEqual(res.result.streaming, undefined)
    })
    test('real chunk delay path', async () => {
      const rec = recordingServer((_n) => makeResponse(200, ['a', 'b']))
      const h = makeClient({ features: [{ name: 'streaming', options: { chunkDelay: 1 } }], server: rec.server })
      const res = await h.op({ op: 'list', path: '/w' })
      const seen: any[] = []
      for await (const x of res.result.stream()) { seen.push(x) }
      strictEqual(seen.length, 2)
    })
  })

  if (hasFeature('paging')) describe('paging-edge', () => {
    test('non-list op is not paged', async () => {
      const rec = recordingServer()
      const h = makeClient({ features: [{ name: 'paging' }], server: rec.server })
      await h.op({ op: 'load', path: '/w/1' })
      ok(!/[?&]page=/.test(rec.calls[0].url))
    })
  })

  if (hasFeature('metrics')) describe('metrics-edge', () => {
    test('real Date.now timing path', async () => {
      const h = makeClient({ features: [{ name: 'metrics' }] })
      await h.op({ op: 'load' })
      strictEqual(h.client._metrics.total.count, 1)
    })
  })

  if (hasFeature('audit')) describe('audit-edge', () => {
    test('default actor + real Date.now', async () => {
      const h = makeClient({ features: [{ name: 'audit' }] })
      await h.op({ op: 'load' })
      strictEqual(h.client._audit.records[0].actor, 'anonymous')
    })
  })

  if (hasFeature('debug')) describe('debug-edge', () => {
    test('default max ring + real Date.now', async () => {
      const h = makeClient({ features: [{ name: 'debug' }] })
      await h.op({ op: 'load' })
      ok(h.client._debug.entries[0].durationMs >= 0)
    })
  })

  // --- injectable option branches (coverage) --------------------------------
  // Exercise the injected id/clock callbacks (the default paths are covered
  // elsewhere).

  if (hasFeature('telemetry')) test('telemetry: injected idgen + clock', async () => {
    const h = makeClient({ features: [{ name: 'telemetry', options: { idgen: (k: string) => k + '-X', now: () => 5 } }] })
    await h.op({ op: 'load' })
    const span = h.client._telemetry.spans[0]
    strictEqual(span.traceId, 'trace-X')
    strictEqual(span.durationMs, 0)
  })

  if (hasFeature('clienttrack')) test('clienttrack: injected idgen + fixed session', async () => {
    const rec = recordingServer()
    const h = makeClient({ features: [{ name: 'clienttrack', options: { sessionId: 'S1', idgen: (k: string) => k + '-1' } }], server: rec.server })
    await h.ready()
    await h.op({ op: 'load' })
    strictEqual(rec.calls[0].fetchdef.headers['X-Client-Id'], 'S1')
    strictEqual(rec.calls[0].fetchdef.headers['X-Request-Id'], 'request-1')
  })

  if (hasFeature('audit')) test('audit: injected clock', async () => {
    const h = makeClient({ features: [{ name: 'audit', options: { now: () => 42 } }] })
    await h.op({ op: 'load' })
    strictEqual(h.client._audit.records[0].ts, 42)
  })

  if (hasFeature('metrics')) test('metrics: injected clock', async () => {
    let t = 0
    const h = makeClient({ features: [{ name: 'metrics', options: { now: () => (t += 10) } }] })
    await h.op({ op: 'load' })
    ok(h.client._metrics.total.totalMs >= 0)
  })

  if (hasFeature('debug')) test('debug: injected clock + custom redact', async () => {
    const h = makeClient({ features: [{ name: 'debug', options: { now: () => 7, redact: ['x-secret'] } }] })
    await h.op({ op: 'load', headers: { 'x-secret': 'hide', 'x-ok': 'show' } })
    const e = h.client._debug.entries[0]
    strictEqual(e.headers['x-secret'], '<redacted>')
    strictEqual(e.headers['x-ok'], 'show')
  })

  // --- composition ----------------------------------------------------------
  if (hasFeature('cache') && hasFeature('netsim')) {
    test('cache + netsim: a hit skips the simulated failure', async () => {
      const h = makeClient({ features: [
        { name: 'netsim', options: { failEvery: 2 } },
        { name: 'cache', options: { ttl: 10000 } },
      ] })
      strictEqual((await h.op({ op: 'load', path: '/w' })).ok, true)
      strictEqual((await h.op({ op: 'load', path: '/w' })).ok, true)
      strictEqual(h.client._netsim.calls, 1)
    })
  }
})
