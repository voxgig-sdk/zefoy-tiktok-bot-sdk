# ZefoyTiktokBot SDK operation

require_relative '../utility/struct/voxgig_struct'

class ZefoyTiktokBotOperation
  attr_accessor :entity, :name, :input, :points, :alias_map

  def initialize(opmap = {})
    opmap ||= {}
    e = VoxgigStruct.getprop(opmap, "entity")
    @entity = (e.is_a?(String) && !e.empty?) ? e : "_"
    n = VoxgigStruct.getprop(opmap, "name")
    @name = (n.is_a?(String) && !n.empty?) ? n : "_"
    i = VoxgigStruct.getprop(opmap, "input")
    @input = (i.is_a?(String) && !i.empty?) ? i : "_"

    @points = []
    raw_points = VoxgigStruct.getprop(opmap, "points")
    if raw_points.is_a?(Array)
      raw_points.each { |t| @points << t if t.is_a?(Hash) }
    end

    raw_alias = VoxgigStruct.getprop(opmap, "alias")
    @alias_map = raw_alias.is_a?(Hash) ? raw_alias : nil
  end
end
