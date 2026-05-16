# ZefoyTiktokBot SDK result

require_relative '../utility/struct/voxgig_struct'

class ZefoyTiktokBotResult
  attr_accessor :ok, :status, :status_text, :headers, :body, :err, :resdata, :resmatch

  def initialize(resmap = {})
    resmap ||= {}
    @ok = VoxgigStruct.getprop(resmap, "ok") == true
    s = VoxgigStruct.getprop(resmap, "status")
    @status = s.is_a?(Numeric) ? s.to_i : -1
    st = VoxgigStruct.getprop(resmap, "statusText")
    @status_text = st.is_a?(String) ? st : ""
    h = VoxgigStruct.getprop(resmap, "headers")
    @headers = h.is_a?(Hash) ? h : {}
    @body = VoxgigStruct.getprop(resmap, "body")
    @err = VoxgigStruct.getprop(resmap, "err")
    @resdata = VoxgigStruct.getprop(resmap, "resdata")
    rm = VoxgigStruct.getprop(resmap, "resmatch")
    @resmatch = rm.is_a?(Hash) ? rm : nil
  end
end
