
import type { Context, FeatureOptions } from '../../types'
import type { ZefoyTiktokBotSDK } from '../../ZefoyTiktokBotSDK'

import { BaseFeature } from '../base/BaseFeature'


const S_NOT_FOUND = 'Not found'


// Which param is entity X's own identifier, as opposed to a parent key —
// the load op's canonical point's LAST path segment, by construction (a
// route addresses parents first, the record last). Mirrors recordKey in
// sdkgen's Main_seneca-provider.ts; written again here because a template
// ships standalone, outside that package. A renamed id (e.g. Airtable's
// record_id) needs its own seeded field: matching only ever happens
// against the API's real param names, never a bare 'id' the API itself
// does not use.
function ownIdField(config: any, getpath: any, entityName: string): string {
  for (const opname of ['load', 'remove', 'update']) {
    const points = getpath(config, ['entity', entityName, 'op', opname, 'points']) || []
    const canonical = points.filter((pt: any) =>
      null == (pt && pt.select && pt.select['$action']))
    const use = 0 < canonical.length ? canonical : points
    let best = use[0]
    for (const pt of use) {
      if (null == pt || null == pt.parts || null == best || null == best.parts) continue
      const ptterm = 0 < pt.parts.length && String(pt.parts[pt.parts.length - 1]).startsWith('{')
      const bestterm = 0 < best.parts.length && String(best.parts[best.parts.length - 1]).startsWith('{')
      if (ptterm !== bestterm ? ptterm : pt.parts.length < best.parts.length) best = pt
    }
    const parts: string[] = (best && best.parts) || []
    const last = [...parts].reverse().find((p: string) => p.startsWith('{'))
    if (null != last) return last.slice(1, -1)
  }
  return 'id'
}


class TestFeature extends BaseFeature {
  version = '0.0.1'
  name = 'test'
  active = true

  _client?: ZefoyTiktokBotSDK
  _options?: any


  init(ctx: Context, options: FeatureOptions): void | Promise<any> {
    this._client = ctx.client
    this._options = options

    const struct = ctx.utility.struct
    const walk = struct.walk
    const size = struct.size
    const setprop = struct.setprop

    const entity = this._options.entity

    this._client._mode = 'test'

    const getpath = struct.getpath

    // Ensure entity ids are correct.
    walk(entity, (k: any, v: any, _parent: any, path: any) => {
      if (2 === size(path)) {
        setprop(v, 'id', k)
        const idField = ownIdField(ctx.config, getpath, String(path[0]))
        if ('id' !== idField) {
          setprop(v, idField, k)
        }
      }
      return v
    })

    const self = this

    function testFetcher(ctx: any, _fullurl: string, _fetchdef: any) {
      const struct = ctx.utility.struct
      const param = ctx.utility.param

      const getprop = struct.getprop
      const clone = struct.clone
      const merge = struct.merge
      const getelem = struct.getelem
      const select = struct.select
      const delprop = struct.delprop
      const getdef = struct.getdef

      // Shape the mock payload the way the real API would, so the op's
      // response transform recovers the entity from it. A point carrying
      // `transform.res: \`body.item\`` describes an API that answers
      // `{item: {...}}`; handing back the bare entity means the transform
      // unwraps a property that is not there and the caller gets undefined.
      // The mock has to agree with the model, or it only ever simulates APIs
      // whose responses happen to be unwrapped.
      function envelope(data: any) {
        const restf = getprop(getprop(ctx.point, 'transform', {}), 'res')
        if (null == data || 'string' !== typeof restf) {
          return data
        }
        // Rebuild whatever nesting the op's response transform unwraps, so
        // the mock agrees with the model. Multi-segment on purpose: GraphQL
        // ops unwrap `body.data.<field>` (and `body.data.<field>.<entity>`
        // for mutation payloads), not just a single envelope property.
        const m = restf.match(/^`body\.(.+)`$/)
        if (null == m) {
          return data
        }
        let out: any = data
        const segs = m[1].split('.')
        for (let i = segs.length - 1; 0 <= i; i--) {
          out = { [segs[i]]: out }
        }
        return out
      }

      function respond(status: number, data?: any, res?: any) {
        const payload = envelope(data)
        const out = merge([
          {
            status,
            statusText: 'OK',
            json: async () => payload,
            body: 'not-used',
          },
          getdef(res, {})
        ])

        const headers: any = getprop(out, 'headers', {})

        // JS specific iterator.
        out.headers = {
          forEach(callback: any) {
            Object.keys(headers).forEach((key) => {
              callback(headers[key], key, this)
            })
          }
        }

        return out
      }


      const op = ctx.op
      const entmap = getprop(entity, op.entity, {})

      if ('load' === op.name) {
        const args = self.buildArgs(ctx, op, ctx.reqmatch)
        const found = select(entmap, args)
        const ent = getelem(found, 0)
        if (null == ent) {
          return respond(404, undefined, { statusText: S_NOT_FOUND })
        }
        else {
          delprop(ent, '$KEY')
          const out = clone(ent)
          return respond(200, out)
        }
      }
      else if ('list' === op.name) {
        const args = self.buildArgs(ctx, op, ctx.reqmatch)
        const found = select(entmap, args)
        if (null == found) {
          return respond(404, undefined, { statusText: S_NOT_FOUND })
        }
        else {
          found.map((ent: any) => delprop(ent, '$KEY'))
          const out = clone(found)
          return respond(200, out)
        }
      }
      else if ('update' === op.name) {
        const args = self.buildArgs(ctx, op, ctx.reqdata)
        const found = select(entmap, args)
        const ent = getelem(found, 0)
        if (null == ent) {
          return respond(404, undefined, { statusText: S_NOT_FOUND })
        }
        else {
          merge([ent, (ctx.reqdata || {})])
          delprop(ent, '$KEY')
          const out = clone(ent)
          return respond(200, out)
        }
      }
      else if ('remove' === op.name) {
        const args = self.buildArgs(ctx, op, ctx.reqmatch)
        const found = select(entmap, args)
        const ent = getelem(found, 0)
        // Remove only the first matched entity. If nothing matches,
        // succeed as a no-op rather than erroring.
        if (null != ent) {
          delprop(entmap, getprop(ent, 'id'))
        }
        return respond(200)
      }
      else if ('create' === op.name) {
        const args = self.buildArgs(ctx, op, ctx.reqdata)
        let id = param(ctx, 'id')
        if (null == id) {
          id = ((1e4 * Math.random() | 0).toString(16) +
            (1e4 * Math.random() | 0).toString(16) +
            (1e4 * Math.random() | 0).toString(16) +
            (1e4 * Math.random() | 0).toString(16)).padEnd(16, '0')
        }

        const ent = clone(ctx.reqdata)
        setprop(ent, 'id', id)

        // A record created during the run needs the same real-key seeding
        // the initial walk gives seed data (see ownIdField above) — without
        // it, only `id` is set, and a load by the entity's own key right
        // after create (recordKey !== 'id') finds nothing.
        const idField = ownIdField(ctx.config, struct.getpath, getprop(op, 'entity'))
        if ('id' !== idField && null == getprop(ent, idField)) {
          setprop(ent, idField, id)
        }

        setprop(entmap, id, ent)
        delprop(ent, '$KEY')
        const out = clone(ent)
        return respond(200, out)
      }
    }

    // Optional network behaviour simulation over the mock transport. Enable
    // per test via `SDK.test({ net: { latency, failTimes, ... } })`. When
    // `net` is absent the mock behaves exactly as before (no wrapping), so
    // existing generated tests are unaffected.
    const net = this._options.net
    ctx.utility.fetcher = (null == net) ? testFetcher : this.makeNetsim(net, testFetcher)
  }


  // Wrap a transport with simulated network conditions: latency (fixed or
  // {min,max}), a budget of first-N failures (`failTimes` -> `failStatus`),
  // first-N connection errors (`errorTimes`), or a hard `offline` outage.
  // Counter-driven, so simulations are deterministic across a test.
  makeNetsim(this: any, net: any, inner: any) {
    const self = this
    self._netcalls = 0

    function pickLatency(): number {
      const l = net.latency
      if (null == l) { return 0 }
      if ('number' === typeof l) { return l < 0 ? 0 : l }
      const min = l.min | 0
      const max = null == l.max ? min : l.max | 0
      return max <= min ? min : min + ((max - min) >> 1)
    }

    function sleep(ms: number): Promise<void> {
      if (null == ms || 0 >= ms) { return Promise.resolve() }
      if ('function' === typeof net.sleep) { return Promise.resolve(net.sleep(ms)) }
      return new Promise((r) => setTimeout(r, ms))
    }

    return async function netsimFetcher(ctx: any, url: string, fetchdef: any) {
      self._netcalls++
      const call = self._netcalls

      if (true === net.offline) {
        await sleep(pickLatency())
        return ctx.error('netsim_offline', 'Simulated network offline (URL was: "' + url + '")')
      }
      if (call <= (net.errorTimes | 0)) {
        await sleep(pickLatency())
        return ctx.error('netsim_conn', 'Simulated connection error (call ' + call + ')')
      }
      if (call <= (net.failTimes | 0)) {
        await sleep(pickLatency())
        const status = null == net.failStatus ? 503 : net.failStatus
        return {
          status,
          statusText: 'Simulated Failure',
          body: 'not-used',
          json: async () => undefined,
          headers: { forEach(_cb: any) { }, get(_k: string) { return undefined } },
        }
      }
      await sleep(pickLatency())
      return inner(ctx, url, fetchdef)
    }
  }


  buildArgs(ctx: any, op: any, args: any): any {
    const struct = ctx.utility.struct
    const param = ctx.utility.param

    const getprop = struct.getprop
    const keysof = struct.keysof
    const getpath = struct.getpath
    const getelem = struct.getelem
    const select = struct.select
    const transform = struct.transform
    const isempty = struct.isempty

    const opname = getprop(op, 'name')
    const points = getpath(ctx.config, [
      'entity', getprop(ctx.entity, 'name'), 'op', opname, 'points']) || []

    // Pick the entity's own endpoint, not a cross-reference from another
    // resource that also returns it — the same rule makePoint falls back to,
    // so the seed-data query is built from the endpoint the request will
    // actually be sent to: a terminal `{id}` marks a record route, and
    // failing that the shallower path wins.
    const isterm = (pt: any) => {
      const parts = pt.parts
      const last = 0 < parts.length ? parts[parts.length - 1] : ''
      return 'string' === typeof last && 0 === last.indexOf('{')
    }

    let point = getelem(points, 0)
    for (let i = 1; i < points.length; i++) {
      const cand = getelem(points, i)
      if (isterm(cand) !== isterm(point) ? isterm(cand) :
        cand.parts.length < point.parts.length) {
        point = cand
      }
    }

    const reqd = transform(
      select(getpath(point, ['args', 'params']), { reqd: true }),
      ['`$EACH`', '', '`$KEY.name`']
    )

    const qand: any[] = []
    const q = { '`$AND`': qand }

    for (let k of keysof(args)) {
      if ('id' === k || !isempty(select(reqd, k))) {
        const v = param(ctx, k)
        const ka = getprop(op.alias, k)

        let qor: any = [{ [k]: v }]
        if (null != ka) {
          qor.push({ [ka]: v })
        }

        qor = { '`$OR`': qor }

        qand.push(qor)
      }
    }

    if (ctx.ctrl.explain) {
      ctx.ctrl.explain.test = { query: q }
    }

    return q
  }
}


export {
  TestFeature,
  ownIdField,
}



