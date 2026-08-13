type Context = any
type Control = any

class EntityOperation {

  #match: any
  #data: any
  #utility: any


  // EJECT-START

  // Resolves to THIS entity, marked as deleted — like every other operation,
  // which resolve to the entity too (see AGENTS.md). The instance keeps the
  // data it held, so a caller can still read what was removed; `deleted()`
  // reports that it is no longer a live record.
  //
  // A DELETE that answers 204 No Content therefore still resolves to
  // something useful, where returning the raw body resolved to `undefined`
  // against a signature that promised a record.
  async remove(
    this: any, reqmatch?: EntityNameRemoveMatch, ctrl?: Control,
  ): Promise<EntyClass> {

    const utility = this._utility

    const {
      makeContext,
      done,
      error,
      featureHook,
      makePoint,
      makeRequest,
      makeResponse,
      makeResult,
      makeSpec,
    } = utility

    let fres: Promise<any> | undefined = undefined

    let ctx: Context = makeContext({
      opname: 'remove',
      ctrl,
      match: this._match,
      data: this._data,
      reqmatch
    }, this._entctx)

    try {

      // #PrePoint-Hook

      ctx.out.point = makePoint(ctx)
      if (ctx.out.point instanceof Error) {
        return error(ctx, ctx.out.point)
      }


      // #PreSpec-Hook

      ctx.out.spec = makeSpec(ctx)
      if (ctx.out.spec instanceof Error) {
        return error(ctx, ctx.out.spec)
      }


      // #PreRequest-Hook

      ctx.out.request = await makeRequest(ctx)
      if (ctx.out.request instanceof Error) {
        return error(ctx, ctx.out.request)
      }


      // #PreResponse-Hook

      ctx.out.response = await makeResponse(ctx)
      if (ctx.out.response instanceof Error) {
        return error(ctx, ctx.out.response)
      }


      // #PreResult-Hook

      ctx.out.result = await makeResult(ctx)
      if (ctx.out.result instanceof Error) {
        return error(ctx, ctx.out.result)
      }


      // #PreDone-Hook

      if (null != ctx.result) {
        if (null != ctx.result.resmatch) {
          this._match = ctx.result.resmatch
        }

        if (null != ctx.result.resdata) {
          this._data = ctx.result.resdata
        }
      }

      const out = done(ctx)

      // An operation resolves to the ENTITY, not the raw data — the record
      // has just been absorbed into this instance and is reached through
      // data(). `done` still runs: it completes the pipeline and raises on
      // failure, and when throwing is disabled it hands back the error
      // payload, which passes through unchanged. See AGENTS.md "Entity
      // operations return ENTITIES".
      if (ctx.result && ctx.result.ok) {
        // A removed entity keeps its data but is no longer a live record.
        this.markDeleted()
        return this
      }

      return out
    }
    catch (err: any) {
      // #PreUnexpected-Hook

      err = this._unexpected(ctx, err)

      if (err) {
        throw err
      }
      else {
        // Off-happy-path (throw disabled): typed as any so the method's
        // Promise<EntyClass> return stays clean under strict null checks.
        return undefined as any
      }
    }
  }

  // EJECT-END


  _unexpected(this: any, ctx: Context, ctrl: any, err: any): any { return err }

}

