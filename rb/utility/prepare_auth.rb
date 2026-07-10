# ZefoyTiktokBot SDK utility: prepare_auth
require_relative 'struct/voxgig_struct'
module ZefoyTiktokBotUtilities
  HEADER_AUTH = "authorization"
  OPTION_APIKEY = "apikey"
  NOT_FOUND = "__NOTFOUND__"

  PrepareAuth = ->(ctx) {
    spec = ctx.spec
    return nil, ctx.make_error("auth_no_spec", "Expected context spec property to be defined.") unless spec

    headers = spec.headers
    options = ctx.client.options_map

    # Public APIs that need no auth omit the options.auth block entirely.
    if options["auth"].nil?
      headers.delete(HEADER_AUTH)
      return spec, nil
    end

    apikey = VoxgigStruct.getprop(options, OPTION_APIKEY, NOT_FOUND)

    if apikey.nil? || (apikey.is_a?(String) && (apikey == NOT_FOUND || apikey == ""))
      headers.delete(HEADER_AUTH)
    else
      auth_prefix = VoxgigStruct.getpath(options, "auth.prefix") || ""
      apikey_val = apikey.is_a?(String) ? apikey : ""
      # Empty prefix (raw apiKey credential) must not add a leading space.
      headers[HEADER_AUTH] =
        auth_prefix.empty? ? apikey_val : "#{auth_prefix} #{apikey_val}"
    end

    return spec, nil
  }
end
