# ProjectName SDK error

class ProjectNameError < StandardError
  attr_accessor :code, :msg, :sdk

  def initialize(code = "", msg = "")
    super(msg)
    @code = code
    @msg = msg
    @sdk = "ProjectName"
  end

  def error
    "#{@sdk}: #{@code}: #{@msg}"
  end
end
