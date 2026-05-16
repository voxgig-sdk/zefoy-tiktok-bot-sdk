
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
class ProjectNameEntityBase {
  name = ''
  name_ = ''
  Name = ''

  _client: ProjectNameSDK
  _utility: Utility
  _entopts: any
  _data: any
  _match: any
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


  data(this: any, data?: any) {
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


  match(match?: any) {
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
