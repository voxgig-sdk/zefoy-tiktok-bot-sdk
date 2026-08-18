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
        "op" => "create,update,load,list,remove,command,direct,graphql",
      },
      "entity" => { "`$CHILD`" => { "`$OPEN`" => true, "active" => false, "alias" => {} } },
      "feature" => { "`$CHILD`" => { "`$OPEN`" => true, "active" => false } },
      "utility" => {},
      "system" => {},
      "test" => { "active" => false, "entity" => { "`$OPEN`" => true } },
      "clean" => { "keys" => "key,token,id" },
      # Server-variable values for a templated base URL (OpenAPI server
      # variables): {name} placeholders in "base" are substituted from this
      # map at construction. Spec defaults arrive via the generated config;
      # user values override them.
      "server" => { "`$CHILD`" => "" },
    }

    sys_fetch = VoxgigStruct.getpath(opts, "system.fetch")

    # Clone the config side before merging: `config` is a process-wide
    # singleton (see Config.shared_config), and merge would otherwise use its
    # nested hashes as merge TARGETS — one instance's options (server,
    # headers, ...) would contaminate every instance constructed after it.
    merged = VoxgigStruct.merge([{}, VoxgigStruct.clone(cfgopts), opts])
    validated = VoxgigStruct.validate(merged, optspec)
    opts = validated.is_a?(Hash) ? validated : {}

    # Resolve a templated base URL (e.g. https://{tenant_id}.hanko.io).
    # Every placeholder must resolve to a non-empty value: from
    # options["server"] (user), else the config default. A placeholder that
    # resolves to "" is a construction ERROR in live mode — the URL cannot
    # work — but in test mode substitutes the deterministic value
    # "test-<name>" so offline tests need no configuration.
    base = opts["base"]
    if base.is_a?(String) && base.include?("{")
      testmode = VoxgigStruct.getpath(opts, "test.active") == true ||
        VoxgigStruct.getpath(opts, "feature.test.active") == true
      server = opts["server"].is_a?(Hash) ? opts["server"] : {}
      sdkname = VoxgigStruct.getpath(config, "main.name")
      sdkname = "SDK" unless sdkname.is_a?(String) && !sdkname.empty?
      opts["base"] = base.gsub(/\{([A-Za-z0-9_]+)\}/) do
        name = Regexp.last_match(1)
        val = server[name]
        val = "" unless val.is_a?(String)
        if val.empty?
          if testmode
            "test-#{name}"
          else
            raise ArgumentError,
              "#{sdkname}: the server variable '#{name}' is required: " \
              "the API base URL is '#{base}' — pass " \
              "{ \"server\" => { \"#{name}\" => \"...\" } } in the SDK options"
          end
        else
          val
        end
      end
    end

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
