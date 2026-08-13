# ZefoyTiktokBot SDK utility type

class ZefoyTiktokBotUtility
  attr_accessor :clean, :done, :make_error, :feature_add, :feature_hook,
                :feature_init, :fetcher, :make_fetch_def, :make_context,
                :make_options, :make_request, :make_response, :make_result,
                :make_point, :make_spec, :make_url, :param, :prepare_auth,
                :prepare_body, :prepare_headers, :prepare_method,
                :prepare_params, :prepare_path, :prepare_query,
                :graphql_body, :graphql_errors,
                :result_basic, :result_body, :result_headers,
                :transform_request, :transform_response, :custom

  @@registrar = nil

  def self.registrar=(r)
    @@registrar = r
  end

  def initialize
    @custom = {}
    @@registrar&.call(self)
  end

  def self.copy(src)
    u = ZefoyTiktokBotUtility.new
    src.instance_variables.each do |var|
      u.instance_variable_set(var, src.instance_variable_get(var))
    end
    u.instance_variable_set(:@custom, src.custom.dup)
    u
  end
end
