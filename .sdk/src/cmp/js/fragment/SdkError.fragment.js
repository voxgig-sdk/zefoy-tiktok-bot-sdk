

class ProjectNameError extends Error {

  isProjectNameError = true

  sdk = 'ProjectName'

  constructor(code, msg, ctx) {
    super(msg)
    this.code = code
    this.ctx = ctx
  }

}

module.exports = {
  ProjectNameError
}

