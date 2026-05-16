# ZefoyTiktokBot SDK utility: result_basic
module ZefoyTiktokBotUtilities
  ResultBasic = ->(ctx) {
    response = ctx.response
    result = ctx.result
    if result && response
      result.status = response.status
      result.status_text = response.status_text
      if result.status >= 400
        msg = "request: #{result.status}: #{result.status_text}"
        if result.err
          prev = result.err.is_a?(ZefoyTiktokBotError) ? result.err.msg : result.err.to_s
          result.err = ctx.make_error("request_status", "#{prev}: #{msg}")
        else
          result.err = ctx.make_error("request_status", msg)
        end
      elsif response.err
        result.err = response.err
      end
    end
    result
  }
end
