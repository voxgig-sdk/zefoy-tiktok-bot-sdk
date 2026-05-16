# ZefoyTiktokBot SDK utility: param
require_relative 'struct/voxgig_struct'
require_relative '../core/helpers'
module ZefoyTiktokBotUtilities
  Param = ->(ctx, paramdef) {
    point = ctx.point
    spec = ctx.spec
    match_val = ctx.match
    reqmatch = ctx.reqmatch
    data = ctx.data
    reqdata = ctx.reqdata

    pt = VoxgigStruct.typify(paramdef)
    key = if (VoxgigStruct::T_string & pt) > 0
            paramdef
          else
            k = VoxgigStruct.getprop(paramdef, "name")
            k.is_a?(String) ? k : ""
          end

    akey = ""
    if point
      alias_map = ZefoyTiktokBotHelpers.to_map(VoxgigStruct.getprop(point, "alias"))
      if alias_map
        ak = VoxgigStruct.getprop(alias_map, key)
        akey = ak if ak.is_a?(String)
      end
    end

    val = VoxgigStruct.getprop(reqmatch, key)
    val = VoxgigStruct.getprop(match_val, key) if val.nil?

    if val.nil? && !akey.empty?
      spec.alias_map[akey] = key if spec
      val = VoxgigStruct.getprop(reqmatch, akey)
    end

    val = VoxgigStruct.getprop(reqdata, key) if val.nil?
    val = VoxgigStruct.getprop(data, key) if val.nil?

    if val.nil? && !akey.empty?
      val = VoxgigStruct.getprop(reqdata, akey)
      val = VoxgigStruct.getprop(data, akey) if val.nil?
    end

    val
  }
end
