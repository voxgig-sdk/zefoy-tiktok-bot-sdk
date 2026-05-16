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
    derived = { "clean" => keyre.empty? ? {} : { "keyre" => keyre } }
    opts["__derived__"] = derived

    opts
  }
end
