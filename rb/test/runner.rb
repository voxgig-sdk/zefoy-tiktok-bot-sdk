# ZefoyTiktokBot SDK test runner

require 'json'

module ZefoyTiktokBotTestRunner
  @env = {}

  def self.load_env_local
    env_file = File.join(File.dirname(__FILE__), '..', '..', '.env.local')
    return unless File.exist?(env_file)

    File.readlines(env_file).each do |line|
      line = line.strip
      next if line.empty? || line.start_with?('#')
      key, val = line.split('=', 2)
      next unless key && val
      @env[key.strip] = val.strip
    end
  end

  def self.getenv(key)
    @env[key] || ENV[key]
  end

  def self.env_override(m)
    live = getenv("ZEFOYTIKTOKBOT_TEST_LIVE")
    override = getenv("ZEFOYTIKTOKBOT_TEST_OVERRIDE")

    if live == "TRUE" || override == "TRUE"
      m.each_key do |key|
        envval = getenv(key)
        if envval && !envval.empty?
          envval = envval.strip
          if envval.start_with?('{')
            begin
              parsed = JSON.parse(envval)
              m[key] = parsed
              next
            rescue JSON::ParserError
            end
          end
          m[key] = envval
        end
      end
    end

    explain = getenv("ZEFOYTIKTOKBOT_TEST_EXPLAIN")
    m["ZEFOYTIKTOKBOT_TEST_EXPLAIN"] = explain if explain && !explain.empty?

    m
  end

  def self.entity_list_to_data(list)
    out = []
    list.each do |item|
      if item.is_a?(Hash)
        out << item
      elsif item.respond_to?(:data_get)
        d = item.data_get
        out << d if d.is_a?(Hash)
      end
    end
    out
  end

  @test_control = nil

  # Load sdk-test-control.json from this test dir; cache. Returns the
  # empty-skip default if the file is missing or invalid.
  def self.load_test_control
    return @test_control unless @test_control.nil?
    ctrl_path = File.join(File.dirname(__FILE__), 'sdk-test-control.json')
    @test_control = begin
      JSON.parse(File.read(ctrl_path))
    rescue StandardError
      {
        'version' => 1,
        'test' => { 'skip' => {
          'live' => { 'direct' => [], 'entityOp' => [] },
          'unit' => { 'direct' => [], 'entityOp' => [] },
        }},
      }
    end
    @test_control
  end

  # Check sdk-test-control.json for a skip entry. Returns [skip, reason].
  def self.is_control_skipped(kind, name, mode)
    ctrl = load_test_control
    skip = (ctrl.dig('test', 'skip', mode) || {})
    items = skip[kind] || []
    items.each do |item|
      if kind == 'direct' && item['test'] == name
        return [true, item['reason']]
      end
      if kind == 'entityOp'
        key = "#{item['entity']}.#{item['op']}"
        return [true, item['reason']] if key == name
      end
    end
    [false, nil]
  end

  # Per-test live pacing delay (ms); default 500.
  def self.live_delay_ms
    ctrl = load_test_control
    v = ctrl.dig('test', 'live', 'delayMs')
    return v if v.is_a?(Integer) && v >= 0
    500
  end
end

# Module-level aliases for test convenience.
Runner = ZefoyTiktokBotTestRunner
Helpers = ZefoyTiktokBotHelpers
Vs = VoxgigStruct
