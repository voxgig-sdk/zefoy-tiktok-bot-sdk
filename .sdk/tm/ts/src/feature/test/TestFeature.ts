
import type { Context, FeatureOptions } from '../../types'
import type { ProjectNameSDK } from '../../ProjectNameSDK'

import { BaseFeature } from '../base/BaseFeature'


const S_NOT_FOUND = 'Not found'


class TestFeature extends BaseFeature {
  version = '0.0.1'
  name = 'test'
  active = true

  _client?: ProjectNameSDK
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

    // Ensure entity ids are correct.
    walk(entity, (k: any, v: any, _parent: any, path: any) => {
      if (2 === size(path)) {
        setprop(v, 'id', k)
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

      function respond(status: number, data?: any, res?: any) {
        const out = merge([
          {
            status,
            statusText: 'OK',
            json: async () => data,
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
        setprop(entmap, id, ent)
        delprop(ent, '$KEY')
        const out = clone(ent)
        return respond(200, out)
      }
    }

    ctx.utility.fetcher = testFetcher
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
    const point =
      getelem(getpath(ctx.config, [
        'entity', getprop(ctx.entity, 'name'), 'op', opname, 'points']), -1)

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
  TestFeature
}



