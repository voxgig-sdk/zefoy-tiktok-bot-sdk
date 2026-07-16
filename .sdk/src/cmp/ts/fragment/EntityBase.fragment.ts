
import { inspect } from 'node:util'

import {
  ProjectNameSDK,
} from './ProjectNameSDK'

import {
  Utility
} from './utility/Utility'

import type {
  Context,
} from './types'


// TODO: needs Entity superclass
// `D` is the entity's typed data model (e.g. Advice); subclasses bind it via
// `class AdviceEntity extends ProjectNameEntityBase<Advice>`.
class ProjectNameEntityBase<D = any> {
  name = ''
  name_ = ''
  Name = ''

  _client: ProjectNameSDK
  _utility: Utility
  _entopts: any
  // `_data`/`_match` hold accreted partial state (they start `{}` and fill in
  // as ops resolve), so they are `Partial<D>` — the full `D` is only asserted
  // at the `data()` return boundary.
  _data: Partial<D>
  _match: Partial<D>
  _entctx: Context


  constructor(client: ProjectNameSDK, entopts: any) {
    entopts = entopts || {}
    entopts.active = false !== entopts.active

    this._client = client
    this._entopts = entopts
    this._utility = client.utility()
    this._data = {}
    this._match = {}

    const makeContext = this._utility.makeContext

    this._entctx = makeContext({
      entity: this,
      entopts,
    }, client._rootctx)

    const featureHook = this._utility.featureHook
    featureHook(this._entctx, 'PostConstructEntity')
  }

  entopts() {
    return this._utility.struct.merge([{}, this._entopts])
  }

  client() {
    return this._client
  }


  data(this: any, data?: Partial<D>): D {
    const struct = this._utility.struct
    const featureHook = this._utility.featureHook

    if (null != data) {
      this._data = struct.clone(data)
      featureHook(this._entctx, 'SetData')
    }

    featureHook(this._entctx, 'GetData')
    let out = struct.clone(this._data)

    return out
  }


  match(this: any, match?: Partial<D>): Partial<D> {
    const struct = this._utility.struct
    const featureHook = this._utility.featureHook

    if (null != match) {
      this._match = struct.clone(match)
      featureHook(this._entctx, 'SetMatch')
    }

    featureHook(this._entctx, 'GetMatch')
    let out = struct.clone(this._match)

    return out
  }


  // Streaming operations. Runs `action` through the full pipeline and returns
  // an async iterator over result items, so the `streaming` feature's
  // incremental output is reachable from a generated entity (a normal op call
  // materialises the whole result). `callopts` parameterises the call:
  //   - inbound (download): iterate the yielded items/chunks (from the
  //     streaming feature when active, else the materialised items);
  //   - outbound (upload): pass an async-iterable `body` to stream a request
  //     payload — it is attached to the request so the transport can send it;
  //   - `ctrl` (pipeline control) and `signal` (AbortSignal) are honoured.
  async *stream(this: any, action: string, args?: any, callopts?: any): AsyncGenerator<any> {
    const utility = this._utility
    const {
      makeContext, done, featureHook,
      makePoint, makeSpec, makeRequest, makeResponse, makeResult,
    } = utility

    callopts = callopts || {}
    const signal = callopts.signal
    const ctrl: any = { ...(callopts.ctrl || {}), stream: callopts }

    const ctx: Context = makeContext({
      opname: action,
      ctrl,
      match: this._match,
      data: this._data,
      ...(args || {}),
    }, this._entctx)

    // Outbound: expose the caller's async-iterable payload so the request
    // builder / transport can stream it as the request body.
    if (null != callopts.body) {
      ;(ctx as any).reqdata = { ...((ctx as any).reqdata || {}), body$: callopts.body }
      ;(ctx as any).stream_out = callopts.body
    }

    try {
      let fres: any

      fres = featureHook(ctx, 'PrePoint'); if (fres instanceof Promise) { await fres }
      ctx.out.point = makePoint(ctx); if (ctx.out.point instanceof Error) { throw ctx.out.point }

      fres = featureHook(ctx, 'PreSpec'); if (fres instanceof Promise) { await fres }
      ctx.out.spec = makeSpec(ctx); if (ctx.out.spec instanceof Error) { throw ctx.out.spec }

      fres = featureHook(ctx, 'PreRequest'); if (fres instanceof Promise) { await fres }
      ctx.out.request = await makeRequest(ctx); if (ctx.out.request instanceof Error) { throw ctx.out.request }

      fres = featureHook(ctx, 'PreResponse'); if (fres instanceof Promise) { await fres }
      ctx.out.response = await makeResponse(ctx); if (ctx.out.response instanceof Error) { throw ctx.out.response }

      fres = featureHook(ctx, 'PreResult'); if (fres instanceof Promise) { await fres }
      ctx.out.result = await makeResult(ctx); if (ctx.out.result instanceof Error) { throw ctx.out.result }

      fres = featureHook(ctx, 'PreDone'); if (fres instanceof Promise) { await fres }

      const result: any = ctx.result

      // Inbound: prefer the streaming feature's incremental iterator; else
      // fall back to the materialised items so `stream` always yields.
      if (result && 'function' === typeof result.stream) {
        for await (const item of result.stream()) {
          if (signal && signal.aborted) { return }
          yield item
        }
      }
      else {
        const data = done(ctx)
        const items = Array.isArray(data) ? data : (null == data ? [] : [data])
        for (const item of items) {
          if (signal && signal.aborted) { return }
          yield item
        }
      }
    }
    catch (err: any) {
      const e = this._unexpected(ctx, err)
      if (e) { throw e }
    }
  }


  toJSON() {
    const struct = this._utility.struct
    return struct.merge([{}, struct.getdef(this._data, {}), { entity$: this.Name }])
  }


  toString() {
    return this.Name + ' ' + this._utility.struct.jsonify(this._data)
  }


  [inspect.custom]() {
    return this.toString()
  }


  _unexpected(this: any, ctx: Context, err: any) {
    const clean = this._utility.clean
    const struct = this._utility.struct

    const delprop = struct.delprop
    const clone = struct.clone
    const merge = struct.merge

    const ctrl = ctx.ctrl

    ctrl.err = err

    if (ctrl.explain) {
      ctx.ctrl.explain = clean(ctx, ctx.ctrl.explain)
      delprop(ctx.ctrl.explain.result, 'err')

      if (null != ctx.result && null != ctx.result.err) {
        ctrl.explain.err = clean(ctx, merge([
          clone({ err: ctx.result.err }).err,
          {
            message: ctx.result.err.message,
            stack: ctx.result.err.stack,
          }]))
      }

      const cleanerr = clean(ctx, merge([
        clone({ err }).err,
        {
          message: err.message,
          stack: err.stack,
        }]))

      if (null == ctrl.explain.err) {
        ctrl.explain.err = cleanerr
      }
      else if (ctrl.explain.err.message != cleanerr.message) {
        ctrl.explain.unexpected = cleanerr
      }
    }

    if (false === ctrl.throw) {
      return undefined
    }

    return err
  }

}


export {
  ProjectNameEntityBase
}
