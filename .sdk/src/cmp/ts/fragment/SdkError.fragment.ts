
import { Context } from './Context'


class ProjectNameError extends Error {

  isProjectNameError = true

  sdk = 'ProjectName'

  code: string
  ctx: Context

  // HTTP status of the response that caused this error, or -1 when the
  // request never got one (transport failure, client-side abort).
  //
  // PROMOTED to the top level on purpose. It used to be reachable only at
  // `err.result.status` — two levels into an object that reads as internal —
  // so every consumer of every generated SDK wrote the same
  // `404 === e?.result?.status` branch and coupled itself to the internal
  // shape of `result`. Mapping "not found" to a null result is table stakes
  // for a client integration.
  status: number = -1


  // `err.notFound` rather than a magic number at every call site.
  get notFound(): boolean { return 404 === this.status }

  constructor(code: string, msg: string, ctx: Context) {
    super(msg)
    this.code = code
    this.ctx = ctx
  }

}

export {
  ProjectNameError
}

