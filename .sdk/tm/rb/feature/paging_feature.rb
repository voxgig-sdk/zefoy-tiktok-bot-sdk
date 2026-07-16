# ZefoyTiktokBot SDK paging feature
#
# Pagination support for list operations. On the way out (PreRequest) it
# stamps page/limit (or a cursor) into the request query; on the way back
# (PreResult) it reads the server's pagination signals - a Link rel="next"
# header, X-Page/X-Next-Page/X-Total-Count headers, or next/cursor/
# nextCursor/hasMore fields in the body - and records them on
# result.paging. A per-call ctrl paging value (page or cursor) takes
# priority. Parameter names ("pageParam", "limitParam", "cursorParam"),
# "startPage" (default 1) and page size ("limit") are configurable.

require_relative 'base_feature'

class ZefoyTiktokBotPagingFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "paging"
    # Inactive until init (feature_init only fires init when active).
    @active = false
    @client = nil
    @options = {}
  end

  def init(ctx, options)
    @client = ctx.client
    @options = options.is_a?(Hash) ? options : {}
    @active = @options["active"] == true
  end

  def PreRequest(ctx)
    return unless @active
    return unless _list?(ctx)
    spec = ctx.spec
    return if spec.nil?
    spec.query = {} if spec.query.nil?

    page_param = @options["pageParam"] || "page"
    limit_param = @options["limitParam"] || "limit"
    cursor_param = @options["cursorParam"] || "cursor"

    # A per-call cursor/page from ctrl takes priority (used by auto-iteration).
    paging = {}
    if ctx.ctrl && ctx.ctrl.respond_to?(:paging) && ctx.ctrl.paging.is_a?(Hash)
      paging = ctx.ctrl.paging
    end

    if !paging["cursor"].nil?
      spec.query[cursor_param] = paging["cursor"]
    elsif spec.query[page_param].nil?
      spec.query[page_param] =
        paging["page"].nil? ? (@options["startPage"] || 1) : paging["page"]
    end

    if !@options["limit"].nil? && spec.query[limit_param].nil?
      spec.query[limit_param] = @options["limit"]
    end
  end

  def PreResult(ctx)
    return unless @active
    return unless _list?(ctx)
    result = ctx.result
    return if result.nil?

    headers = result.headers || {}
    body = result.body

    paging = {
      "page" => _num(_header(headers, "x-page")),
      "totalCount" => _num(_header(headers, "x-total-count")),
      "nextPage" => _num(_header(headers, "x-next-page")),
      "next" => nil,
      "cursor" => nil,
      "hasMore" => false,
    }

    # Link: <...>; rel="next"
    link = _header(headers, "link")
    unless link.nil?
      m = /<([^>]+)>\s*;\s*rel="?next"?/i.match(link.to_s)
      paging["next"] = m[1] if m
    end

    # Body-level cursors.
    if body.is_a?(Hash)
      paging["next"] = paging["next"] || body["next"] unless body["next"].nil?
      paging["cursor"] = body["cursor"] unless body["cursor"].nil?
      paging["cursor"] = body["nextCursor"] unless body["nextCursor"].nil?
      paging["hasMore"] = body["hasMore"] if body["hasMore"] == true || body["hasMore"] == false
    end

    paging["hasMore"] = paging["hasMore"] ||
      !paging["next"].nil? || !paging["cursor"].nil? || !paging["nextPage"].nil?

    result.paging = paging

    @client.instance_variable_set(:@_paging, { "last" => paging })
  end

  def _list?(ctx)
    ops = @options["ops"] || ["list"]
    ops.include?(ctx.op ? ctx.op.name : nil)
  end

  def _header(headers, name)
    lower = name.downcase
    headers.each do |k, v|
      return v if k.to_s.downcase == lower
    end
    nil
  end

  def _num(v)
    return nil if v.nil?
    n = Integer(v.to_s, exception: false)
    return n unless n.nil?
    Float(v.to_s, exception: false)
  end
end
