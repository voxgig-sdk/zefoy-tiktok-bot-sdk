# ZefoyTiktokBot SDK utility: make_options
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  MakeOptions = ->(ctx) {
    options = ctx.options || {}

    custom_utils = VoxgigStruct.getprop(options, "utility")
    if custom_utils.is_a?(Hash) && ctx.utility
      custom_utils.each { |k, v| ctx.utility.custom[k] = v }
    end

    opts = VoxgigStruct.clone(options)
    opts = {} unless opts.is_a?(Hash)

    # Feature add-order. options["feature"] may be given as an ordered ARRAY of
    # { "name" => ..., "active" => ..., ... } entries (the array position IS the
    # order in which features are added), or as a { "name" => {opts} } map.
    # Normalize an array to a map (so merge/validate/init are unchanged) and
    # remember the explicit order; a map defaults to test-first so the `test`
    # mock transport is installed as the base of the transport wrapper chain.
    featureorder = []
    if opts["feature"].is_a?(Array)
      fmap = {}
      opts["feature"].each do |entry|
        next unless entry.is_a?(Hash)
        name = entry["name"]
        next if name.nil?
        fopts = entry.reject { |k, _| k == "name" }
        fmap[name] = fopts
        featureorder << name
      end
      opts["feature"] = fmap
    end

    config = ctx.config || {}
    cfgopts = config["options"].is_a?(Hash) ? config["options"] : {}

    optspec = {
      "apikey" => "",
      "base" => "http://localhost:8000",
      "prefix" => "",
      "suffix" => "",
      "auth" => { "prefix" => "" },
      "headers" => { "`$CHILD`" => "`$STRING`" },
      "allow" => {
        "method" => "GET,PUT,POST,PATCH,DELETE,OPTIONS",
        "op" => "create,update,load,list,remove,command,direct",
      },
      "entity" => { "`$CHILD`" => { "`$OPEN`" => true, "active" => false, "alias" => {} } },
      "feature" => { "`$CHILD`" => { "`$OPEN`" => true, "active" => false } },
      "utility" => {},
      "system" => {},
      "test" => { "active" => false, "entity" => { "`$OPEN`" => true } },
      "clean" => { "keys" => "key,token,id" },
    }

    sys_fetch = VoxgigStruct.getpath(opts, "system.fetch")

    merged = VoxgigStruct.merge([{}, cfgopts, opts])
    validated = VoxgigStruct.validate(merged, optspec)
    opts = validated.is_a?(Hash) ? validated : {}

    if sys_fetch
      opts["system"] = {} unless opts["system"].is_a?(Hash)
      opts["system"]["fetch"] = sys_fetch
    end

    clean_keys = VoxgigStruct.getpath(opts, "clean.keys")
    clean_keys = "key,token,id" unless clean_keys.is_a?(String)
    parts = clean_keys.split(",").map(&:strip).reject(&:empty?).map { |p| VoxgigStruct.escre(p) }
    keyre = parts.join("|")

    # Resolve the feature add-order: an explicit array order (above) wins;
    # otherwise order the map test-first, then the remaining names sorted, so
    # the outcome is deterministic and `test` is always the base transport.
    if featureorder.empty?
      fmap = opts["feature"]
      names = fmap.is_a?(Hash) ? fmap.keys.select { |k| k.is_a?(String) }.sort : []
      if names.include?("test")
        featureorder = ["test"] + names.reject { |n| n == "test" }
      else
        featureorder = names
      end
    end

    derived = { "clean" => keyre.empty? ? {} : { "keyre" => keyre } }
    derived["featureorder"] = featureorder
    opts["__derived__"] = derived

    opts
  }
end
