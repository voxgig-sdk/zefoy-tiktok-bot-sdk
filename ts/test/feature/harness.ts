
// Offline feature-test harness for the generated SDK.
//
// Feature behaviour (retry, cache, rbac, telemetry, ...) is unit-tested by
// driving each feature class through a faithful miniature of the real
// operation pipeline against a configurable mock transport — the same hook
// order and short-circuit rules as the generated Entity*Op code, but with
// no live server and no API-specific fixtures. Feature instances are built
// via `config.makeFeature`, so only features actually present in this SDK
// are exercised (see `hasFeature`).

import { config, stdutil } from '../..'


const struct: any = (stdutil as any).struct


// True when this SDK was generated with the named feature.
function hasFeature(name: string): boolean {
  return null != (config as any).feature?.[name]
}


// A deterministic virtual clock: `now()` advances only when `sleep(ms)` is
// called, so timing-based features can be asserted without real delays.
function makeClock(start = 0) {
  let t = start
  return {
    now: () => t,
    sleep: (ms: number) => { t += (ms || 0) },
    advance: (ms: number) => { t += ms },
    get time() { return t },
  }
}


// Build a transport-shaped response the pipeline understands.
function makeResponse(status: number, data?: any, headers?: Record<string, any>): any {
  const h: Record<string, any> = {}
  for (const k of Object.keys(headers || {})) {
    h[k.toLowerCase()] = (headers as any)[k]
  }
  return {
    status,
    statusText: status < 400 ? 'OK' : 'ERR',
    body: 'not-used',
    json: async () => data,
    headers: {
      get(key: string) { return h[String(key).toLowerCase()] },
      forEach(cb: any) { Object.keys(h).forEach((k) => cb(h[k], k, this)) },
    },
  }
}


type ServerFn = (ctx: any, url: string, fetchdef: any) => any


function defaultServer(): ServerFn {
  return (_ctx: any, _url: string, fetchdef: any) => {
    const method = (fetchdef.method || 'GET').toUpperCase()
    if ('GET' === method) {
      return makeResponse(200, { ok: true, method })
    }
    return makeResponse(200, { ok: true, method, echo: fetchdef.body })
  }
}


function defaultMethod(op: string): string {
  if ('create' === op) return 'POST'
  if ('update' === op) return 'PATCH'
  if ('remove' === op) return 'DELETE'
  return 'GET'
}


// Construct a fake client wired with the given features (in init order) and
// a mini operation pipeline. `features` is a list of { name, options }.
function makeClient(spec: {
  features: Array<{ name: string, options?: any }>
  server?: ServerFn
  mode?: string
  base?: string
  headers?: Record<string, any>
}) {
  const base = spec.base || 'http://api.test'
  const server: ServerFn = spec.server || defaultServer()

  const utility: any = {
    struct,
    fetcher: server,
    param: (ctx: any, name: string) => {
      const p = (ctx.spec && ctx.spec.params) || {}
      const q = (ctx.spec && ctx.spec.query) || {}
      return null != p[name] ? p[name] : q[name]
    },
  }

  const client: any = {
    _mode: spec.mode || 'test',
    _features: [],
    _options: { base, headers: spec.headers || {}, feature: {} },
    options() { return this._options },
    utility() { return utility },
  }

  function makeErr(code: string, msg: string): any {
    const e: any = new Error(msg)
    e.code = code
    e.isSdkError = true
    return e
  }

  let idseq = 0
  const rootShared = new WeakMap()
  function makeCtx(over: any): any {
    idseq++
    return {
      id: 'C' + idseq,
      client,
      utility,
      out: {},
      ctrl: over.ctrl || {},
      meta: {},
      op: over.op,
      entity: over.entity,
      spec: undefined,
      response: undefined,
      result: undefined,
      shared: rootShared,
      error(code: string, m: string) { return makeErr(code, m) },
    }
  }

  async function featureHook(ctx: any, name: string) {
    const resp: any[] = []
    for (const f of client._features) {
      const fn = (f as any)[name]
      if ('function' === typeof fn) {
        const r = fn.call(f, ctx)
        if (r instanceof Promise) { resp.push(r) }
      }
    }
    if (0 < resp.length) { await Promise.all(resp) }
  }

  const rootctx = makeCtx({ op: { name: 'root', entity: '_' }, entity: undefined })

  // Instantiate + init the requested features (skipping any not present in
  // this SDK), then fire PostConstruct.
  for (const fspec of spec.features) {
    if (!hasFeature(fspec.name)) { continue }
    const f = (config as any).makeFeature(fspec.name)
    const fopts = { active: true, ...(fspec.options || {}) }
    client._options.feature[f.name] = fopts
    f.init(rootctx, fopts)
    client._features.push(f)
  }

  function buildUrl(sp: any): string {
    const q = sp.query || {}
    const keys = Object.keys(q).filter((k) => null != q[k]).sort()
    const qs = keys.map((k) =>
      encodeURIComponent(k) + '=' + encodeURIComponent(String(q[k]))).join('&')
    return sp.base + (sp.path || '') + (qs ? '?' + qs : '')
  }

  async function populateResult(ctx: any, response: any) {
    const result: any = {
      ok: false, status: -1, statusText: '', headers: {},
      body: undefined, resdata: undefined, err: undefined,
    }
    ctx.result = result

    if (response instanceof Error) {
      result.err = response
      return
    }
    result.status = response.status
    result.statusText = response.statusText
    if (response.headers && response.headers.forEach) {
      response.headers.forEach((v: any, k: any) => result.headers[k] = v)
    }
    if ('function' === typeof response.json) {
      result.body = await response.json()
    }
    result.resdata = result.body
    if (result.status >= 400) {
      result.err = makeErr('request_status',
        'request: ' + result.status + ': ' + result.statusText)
    }
    else if (response.err) {
      result.err = response.err
    }
    if (null == result.err) {
      result.ok = true
    }
  }

  // Run one operation through the mini pipeline (mirrors the generated
  // Entity*Op fragment: hook, short-circuit, make*, hook, ...).
  async function op(o: {
    entity?: string
    op?: string
    method?: string
    path?: string
    query?: any
    headers?: any
    body?: any
    ctrl?: any
  }): Promise<any> {
    const entity = o.entity || 'widget'
    const opname = o.op || 'load'
    const method = o.method || defaultMethod(opname)

    const ctx = makeCtx({
      op: { name: opname, entity },
      entity: { name: entity },
      ctrl: o.ctrl || {},
    })

    await featureHook(ctx, 'PostConstructEntity')

    try {
      await featureHook(ctx, 'PrePoint')
      if (ctx.out.point instanceof Error) {
        throw ctx.out.point
      }

      await featureHook(ctx, 'PreSpec')
      ctx.spec = ctx.out.spec || {
        method, base, path: o.path || ('/' + entity),
        url: undefined, params: {},
        headers: { ...(spec.headers || {}), ...(o.headers || {}) },
        query: { ...(o.query || {}) },
        body: o.body, step: 'start',
      }

      await featureHook(ctx, 'PreRequest')
      ctx.spec.url = buildUrl(ctx.spec)

      let response: any
      if (ctx.out.request) {
        response = ctx.out.request
      }
      else {
        const fetchdef: any = {
          url: ctx.spec.url,
          method: ctx.spec.method,
          headers: ctx.spec.headers,
          body: ctx.spec.body,
        }
        response = await utility.fetcher(ctx, fetchdef.url, fetchdef)
      }
      ctx.response = response

      await featureHook(ctx, 'PreResponse')
      await populateResult(ctx, response)
      await featureHook(ctx, 'PreResult')
      await featureHook(ctx, 'PreDone')

      if (ctx.result && ctx.result.ok) {
        return { ok: true, data: ctx.result.resdata, result: ctx.result, ctx }
      }
      throw (ctx.result && ctx.result.err) || ctx.error('op_failed', 'operation failed')
    }
    catch (err: any) {
      await featureHook(ctx, 'PreUnexpected')
      return { ok: false, error: err, result: ctx.result, ctx }
    }
  }

  const boot = featureHook(rootctx, 'PostConstruct')

  return {
    client,
    utility,
    rootctx,
    op,
    ready: async () => { await boot },
    feature: (name: string) => client._features.find((f: any) => f.name === name),
  }
}


export {
  hasFeature,
  makeClient,
  makeClock,
  makeResponse,
  defaultServer,
}
