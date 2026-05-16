# ZefoyTiktokBot SDK utility: fetcher
require_relative 'struct/voxgig_struct'
require 'net/http'
require 'uri'
require 'json'

module ZefoyTiktokBotUtilities
  DefaultHttpFetch = ->(fullurl, fetchdef) {
    method_str = fetchdef["method"] || "GET"
    body_str = fetchdef["body"]
    headers = fetchdef["headers"] || {}

    begin
      uri = URI.parse(fullurl)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")

      klass = case method_str.upcase
              when "POST" then Net::HTTP::Post
              when "PUT" then Net::HTTP::Put
              when "DELETE" then Net::HTTP::Delete
              when "PATCH" then Net::HTTP::Patch
              else Net::HTTP::Get
              end

      request = klass.new(uri)
      has_ua = false
      headers.each do |k, v|
        next unless v.is_a?(String)
        has_ua = true if k.to_s.downcase == 'user-agent'
        request[k] = v.to_s
      end
      # Default User-Agent — Net::HTTP sets "Ruby" which some CDNs block.
      # Use a Mozilla-shaped UA unless the caller already set one.
      request['User-Agent'] = 'Mozilla/5.0 (compatible; ZefoyTiktokBotSDK/1.0)' unless has_ua
      request.body = body_str if body_str.is_a?(String)

      resp = http.request(request)
      resp_headers = {}
      resp.each_header { |k, v| resp_headers[k.downcase] = v }

      json_body = nil
      begin
        json_body = JSON.parse(resp.body) if resp.body && !resp.body.empty?
      rescue JSON::ParserError
      end

      return {
        "status" => resp.code.to_i,
        "statusText" => resp.message,
        "headers" => resp_headers,
        "json" => -> { json_body },
        "body" => resp.body,
      }, nil
    rescue StandardError => e
      # Network-level failures (DNS, TCP, TLS, timeouts) — return a synthesized
      # response with status 0 so callers can branch on result.ok like any
      # other failed request, instead of seeing an unhandled exception.
      return {
        "status" => 0,
        "statusText" => "#{e.class}: #{e.message}",
        "headers" => {},
        "json" => -> { nil },
        "body" => nil,
      }, nil
    end
  }

  Fetcher = ->(ctx, fullurl, fetchdef) {
    if ctx.client.mode != "live"
      return nil, ctx.make_error("fetch_mode_block",
        "Request blocked by mode: \"#{ctx.client.mode}\" (URL was: \"#{fullurl}\")")
    end

    options = ctx.client.options_map
    if VoxgigStruct.getpath(options, "feature.test.active") == true
      return nil, ctx.make_error("fetch_test_block",
        "Request blocked as test feature is active (URL was: \"#{fullurl}\")")
    end

    sys_fetch = VoxgigStruct.getpath(options, "system.fetch")

    return DefaultHttpFetch.call(fullurl, fetchdef) if sys_fetch.nil?
    return sys_fetch.call(fullurl, fetchdef) if sys_fetch.is_a?(Proc)

    return nil, ctx.make_error("fetch_invalid", "system.fetch is not a valid function")
  }
end
