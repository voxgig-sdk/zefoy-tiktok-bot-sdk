# ZefoyTiktokBot SDK spec

class ZefoyTiktokBotSpec
  attr_accessor :parts, :headers, :alias_map, :base, :prefix, :suffix,
                :params, :query, :step, :method, :body, :url, :path

  def initialize(specmap = {})
    specmap ||= {}
    @parts = specmap["parts"] || specmap[:parts] || []
    @headers = specmap["headers"] || specmap[:headers] || {}
    @alias_map = specmap["alias"] || specmap[:alias] || {}
    @base = specmap["base"] || specmap[:base] || ""
    @prefix = specmap["prefix"] || specmap[:prefix] || ""
    @suffix = specmap["suffix"] || specmap[:suffix] || ""
    @params = specmap["params"] || specmap[:params] || {}
    @query = specmap["query"] || specmap[:query] || {}
    @step = specmap["step"] || specmap[:step] || ""
    @method = specmap["method"] || specmap[:method] || "GET"
    @body = specmap["body"] || specmap[:body]
    @url = specmap["url"] || specmap[:url] || ""
    @path = specmap["path"] || specmap[:path] || ""
  end
end
