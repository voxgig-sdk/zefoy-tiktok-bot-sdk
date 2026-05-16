
import { Context } from './Context'


class ProjectNameError extends Error {

  isProjectNameError = true

  sdk = 'ProjectName'

  code: string
  ctx: Context

  constructor(code: string, msg: string, ctx: Context) {
    super(msg)
    this.code = code
    this.ctx = ctx
  }

}

export {
  ProjectNameError
}

