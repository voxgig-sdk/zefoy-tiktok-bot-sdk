# ZefoyTiktokBot SDK utility: make_url
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  MakeUrl = ->(ctx) {
    spec = ctx.spec
    result = ctx.result

    return "", ctx.make_error("url_no_spec", "Expected context spec property to be defined.") unless spec
    return "", ctx.make_error("url_no_result", "Expected context result property to be defined.") unless result

    url = VoxgigStruct.join([spec.base, spec.prefix, spec.path, spec.suffix], "/", true)
    resmatch = {}

    param_items = VoxgigStruct.items(spec.params)
    if param_items
      param_items.each do |item|
        key = item[0]
        val = item[1]
        if val && key.is_a?(String)
          placeholder = "{#{key}}"
          val_str = val.is_a?(String) ? val : val.to_s
          encoded = VoxgigStruct.escurl(val_str)
          url = url.gsub(placeholder, encoded)
          resmatch[key] = val
        end
      end
    end

    # Append query string from spec.query.
    qsep = "?"
    query_items = VoxgigStruct.items(spec.respond_to?(:query) ? spec.query : nil)
    if query_items
      query_items.each do |item|
        key = item[0]
        val = item[1]
        if val && key.is_a?(String)
          val_str = val.is_a?(String) ? val : val.to_s
          url += qsep + VoxgigStruct.escurl(key) + "=" + VoxgigStruct.escurl(val_str)
          qsep = "&"
          resmatch[key] = val
        end
      end
    end

    result.resmatch = resmatch
    return url, nil
  }
end
