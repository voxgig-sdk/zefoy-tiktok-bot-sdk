
import { Context } from './Context'


class ZefoyTiktokBotError extends Error {

  isZefoyTiktokBotError = true

  sdk = 'ZefoyTiktokBot'

  code: string
  ctx: Context

  constructor(code: string, msg: string, ctx: Context) {
    super(msg)
    this.code = code
    this.ctx = ctx
  }

}

export {
  ZefoyTiktokBotError
}

