# ZefoyTiktokBot SDK control

class ZefoyTiktokBotControl
  attr_accessor :throw_err, :err, :explain, :actor, :paging

  def initialize(opts = {})
    @throw_err = opts[:throw_err]
    @err = nil
    @explain = opts[:explain]
    # Per-call audit actor (used by the audit feature).
    @actor = opts[:actor]
    # Per-call paging override (used by the paging feature).
    @paging = opts[:paging]
  end
end
