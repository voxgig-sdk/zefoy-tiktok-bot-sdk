# ZefoyTiktokBot SDK streaming feature
#
# Streaming result support. For list-style operations it attaches a
# result.stream Enumerator so callers can consume items incrementally with
# result.stream.each { |item| ... } instead of materialising the whole
# array. The Enumerator reads the result's data lazily (on first
# iteration), so it reflects the parsed entities. A "chunkDelay" (ms)
# simulates paced/chunked delivery for offline tests via the injectable
# "sleep"; a "chunkSize" groups items into batches when set.

require_relative 'base_feature'

class ZefoyTiktokBotStreamingFeature < ZefoyTiktokBotBaseFeature
  def initialize
    super
    @version = "0.0.1"
    @name = "streaming"
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

  def PreResult(ctx)
    return unless @active
    return unless _streamable?(ctx)
    result = ctx.result
    return if result.nil?

    feature = self
    result.streaming = true
    result.stream = Enumerator.new do |y|
      feature.iterate(result, y)
    end

    track = @client.instance_variable_get(:@_streaming)
    if track.nil?
      track = { "opened" => 0 }
      @client.instance_variable_set(:@_streaming, track)
    end
    track["opened"] += 1
  end

  def iterate(result, y)
    chunk_delay = @options["chunkDelay"] || 0
    chunk_size = @options["chunkSize"] || 0

    # Read lazily so downstream result processing is reflected.
    items = result.resdata.is_a?(Array) ? result.resdata : []

    if chunk_size > 0
      items.each_slice(chunk_size) do |batch|
        _sleep(chunk_delay) if chunk_delay > 0
        y << batch
      end
      return
    end

    items.each do |item|
      _sleep(chunk_delay) if chunk_delay > 0
      y << item
    end
  end

  def _streamable?(ctx)
    ops = @options["ops"] || ["list"]
    ops.include?(ctx.op ? ctx.op.name : nil)
  end

  def _sleep(ms)
    return if ms.nil? || ms <= 0
    s = @options["sleep"]
    if s.is_a?(Proc)
      s.call(ms)
    else
      sleep(ms / 1000.0)
    end
  end
end
