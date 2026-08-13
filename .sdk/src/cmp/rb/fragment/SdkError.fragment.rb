# ProjectName SDK error

class ProjectNameError < StandardError
  # `status` is the HTTP status of the response that caused this error, or
  # -1 when the request never got one. PROMOTED to the top level: it used to
  # be reachable only at `err.result.status`, so every consumer coupled
  # itself to the internal shape of `result`.
  attr_accessor :code, :msg, :sdk, :status

  def initialize(code = "", msg = "")
    super(msg)
    @code = code
    @msg = msg
    @sdk = "ProjectName"
    @status = -1
  end

  def not_found?
    404 == @status
  end

  def error
    "#{@sdk}: #{@code}: #{@msg}"
  end
end
