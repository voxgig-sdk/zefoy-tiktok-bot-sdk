# ProjectName SDK test feature

require_relative '../utility/struct/voxgig_struct'
require_relative 'base_feature'

class ProjectNameTestFeature < ProjectNameBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "test"
    @active = true
    @client = nil
    @options = nil
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options

    entity = VoxgigStruct.getprop(options, "entity")
    entity = {} unless entity.is_a?(Hash)

    @client.mode = "test"

    # Ensure entity ids are correct.
    VoxgigStruct.walk(entity) do |key, val, parent, path|
      if path.length == 2 && val.is_a?(Hash) && key
        val["id"] = key
      end
      val
    end

    test_self = self

    test_fetcher = ->(fctx, _fullurl, _fetchdef) {
      respond = ->(status, data, extra) {
        out = {
          "status" => status,
          "statusText" => "OK",
          "json" => -> { data },
          "body" => "not-used",
        }
        extra&.each { |k, v| out[k] = v }
        return out, nil
      }

      op = fctx.op
      entmap = VoxgigStruct.getprop(entity, op.entity)
      entmap = {} unless entmap.is_a?(Hash)

      # For single-entity ops (load, remove) with an empty explicit match, fall
      # back to the id the entity client already knows from a prior create/load
      # (in fctx.match / fctx.data). Mirrors the TS mock where param() resolves
      # the id from that accumulated state.
      resolve_match = lambda do |explicit|
        return explicit if explicit.is_a?(Hash) && !explicit.empty?
        [fctx.match, fctx.data].each do |src|
          next if src.nil?
          v = VoxgigStruct.getprop(src, "id")
          return { "id" => v } if !v.nil? && v != "__UNDEFINED__"
        end
        {}
      end

      if op.name == "load"
        args = test_self.build_args(fctx, op, resolve_match.call(fctx.reqmatch))
        found = VoxgigStruct.select(entmap, args)
        ent = VoxgigStruct.getelem(found, 0)
        return respond.call(404, nil, { "statusText" => "Not found" }) unless ent
        VoxgigStruct.delprop(ent, "$KEY")
        out = VoxgigStruct.clone(ent)
        respond.call(200, out, nil)

      elsif op.name == "list"
        args = test_self.build_args(fctx, op, fctx.reqmatch)
        found = VoxgigStruct.select(entmap, args)
        return respond.call(404, nil, { "statusText" => "Not found" }) unless found
        if found.is_a?(Array)
          found.each { |item| VoxgigStruct.delprop(item, "$KEY") }
        end
        out = VoxgigStruct.clone(found)
        respond.call(200, out, nil)

      elsif op.name == "update"
        # Match the existing entity by id only (or its alias). reqdata also
        # contains the new field values, which would otherwise cause select
        # to filter out the entity we want to update. Falls back to first
        # entity when no id present and no match found, mirroring the TS
        # mock's empirical behavior where param(undef) collapses to "no
        # constraint" and select returns all.
        update_match = {}
        if fctx.reqdata.is_a?(Hash)
          update_match["id"] = fctx.reqdata["id"] if fctx.reqdata.key?("id")
          if op.alias_map
            alias_id = VoxgigStruct.getprop(op.alias_map, "id")
            if alias_id && fctx.reqdata.key?(alias_id)
              update_match[alias_id] = fctx.reqdata[alias_id]
            end
          end
        end
        args = test_self.build_args(fctx, op, update_match)
        found = VoxgigStruct.select(entmap, args)
        ent = VoxgigStruct.getelem(found, 0)
        if ent.nil? && entmap.is_a?(Hash) && !entmap.empty?
          ent = entmap.values.find { |e| e.is_a?(Hash) }
        end
        return respond.call(404, nil, { "statusText" => "Not found" }) unless ent
        if ent.is_a?(Hash) && fctx.reqdata
          fctx.reqdata.each { |k, v| ent[k] = v }
        end
        VoxgigStruct.delprop(ent, "$KEY")
        out = VoxgigStruct.clone(ent)
        respond.call(200, out, nil)

      elsif op.name == "remove"
        args = test_self.build_args(fctx, op, resolve_match.call(fctx.reqmatch))
        found = VoxgigStruct.select(entmap, args)
        ent = VoxgigStruct.getelem(found, 0)
        # Remove only the first matched entity. If nothing matches,
        # succeed as a no-op rather than erroring.
        if ent.is_a?(Hash)
          id = VoxgigStruct.getprop(ent, "id")
          VoxgigStruct.delprop(entmap, id)
        end
        respond.call(200, nil, nil)

      elsif op.name == "create"
        test_self.build_args(fctx, op, fctx.reqdata)
        id = fctx.utility.param.call(fctx, "id")
        id ||= "%04x%04x%04x%04x" % [rand(0x10000), rand(0x10000), rand(0x10000), rand(0x10000)]

        ent = VoxgigStruct.clone(fctx.reqdata)
        if ent.is_a?(Hash)
          ent["id"] = id
          entmap[id.to_s] = ent if id.is_a?(String)
          VoxgigStruct.delprop(ent, "$KEY")
          out = VoxgigStruct.clone(ent)
          return respond.call(200, out, nil)
        end
        respond.call(200, ent, nil)

      else
        respond.call(404, nil, { "statusText" => "Unknown operation" })
      end
    }

    ctx.utility.fetcher = test_fetcher
  end

  def build_args(ctx, op, args)
    opname = op.name
    points = VoxgigStruct.getpath(ctx.config, "entity.#{ctx.entity.get_name}.op.#{opname}.points")
    point = VoxgigStruct.getelem(points, -1)

    params_path = VoxgigStruct.getpath(point, "args.params")
    reqd_params = VoxgigStruct.select(params_path, { "reqd" => true })
    reqd = VoxgigStruct.transform(reqd_params, ["`$EACH`", "", "`$KEY.name`"])

    qand = []
    q = { "`$AND`" => qand }

    if args
      keys = VoxgigStruct.keysof(args)
      if keys
        keys.each do |key|
          is_id = (key == "id")
          selected = VoxgigStruct.select(reqd, key)
          is_reqd = !VoxgigStruct.isempty(selected)

          if is_id || is_reqd
            v = ctx.utility.param.call(ctx, key)
            ka = op.alias_map ? VoxgigStruct.getprop(op.alias_map, key) : nil

            qor = [{ key => v }]
            qor << { ka => v } if ka.is_a?(String)

            qand << { "`$OR`" => qor }
          end
        end
      end
    end

    q["`$AND`"] = qand
    ctx.ctrl.explain["test"] = { "query" => q } if ctx.ctrl.explain

    q
  end
end
