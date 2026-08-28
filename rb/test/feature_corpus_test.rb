# ZefoyTiktokBot SDK feature corpus test
#
# Feature behaviour, driven by the SHARED corpus.
#
# The same route primary_utility_test.rb takes for the utilities:
# language-neutral cases in .sdk/test/test.json, executed against THIS
# generated SDK. The feature is the ordinary class, built by the generated
# config, installed by the generated constructor, and driven by a real entity
# operation. Not a miniature of the pipeline, which can only be as right as
# the miniature.
#
# Everything in a case is data. The one piece ruby writes for itself is
# turning scripted responses into a fetcher, through the documented
# `utility.fetcher` override.

require "minitest/autorun"
require "json"
require_relative "../ZefoyTiktokBot_sdk"

class FeatureCorpusTest < Minitest::Test

  # Features with a corpus section are read from the corpus itself (see
  # test_feature_corpus), so a project-authored section - a custom feature
  # added under .sdk/test/feature/ - runs without editing this file. An SDK
  # generated without a listed feature still skips, not fails.

  # The standard operation names, in the order the runner prefers them.
  FEATURE_CORPUS_OPS = %w[load list create update remove].freeze

  def corpus
    @corpus ||= JSON.parse(
      File.read(File.join(__dir__, "..", "..", ".sdk", "test", "test.json")))
  end

  # A scripted transport built from a case's `res` list. Responses are
  # consumed in order and the last one repeats, so a case that does not care
  # how many attempts happen need only declare one.
  #
  # Returns the shape the real fetcher returns: a [response, err] PAIR, with
  # the parsed body behind a `json` lambda and `body` as the raw string. A
  # script that only set `body` would look like an empty result, which reads
  # as a feature defect rather than a mis-shaped script.
  def scripted_fetcher(res)
    n = -1
    lambda do |_ctx, _fullurl, _fetchdef|
      n += 1
      spec = {}
      if res.is_a?(Array) && !res.empty?
        i = n >= res.length ? res.length - 1 : n
        spec = res[i] || {}
      end

      return [nil, RuntimeError.new("scripted transport failure")] if spec["throw"] == true

      status = spec["status"].nil? ? 200 : spec["status"].to_i
      body = spec["body"].nil? ? {} : spec["body"]

      [{
        "status" => status,
        "statusText" => status < 400 ? "OK" : "ERR",
        "headers" => (spec["headers"] || {}).dup,
        "json" => -> { body },
        "body" => JSON.generate(body),
      }, nil]
    end
  end

  # Build a client the way a caller would.
  #
  # ZefoyTiktokBotSDK.new, not ZefoyTiktokBotSDK.test: the `test` feature is
  # transport: 'base' and REPLACES the transport, so a client in test mode
  # would shadow the script.
  def build_client(kase)
    opts = { "utility" => { "fetcher" => scripted_fetcher(kase["res"]) } }
    opts["feature"] = kase["feature"] unless kase["feature"].nil?
    ZefoyTiktokBotSDK.new(opts)
  end

  # Every operation this SDK declares, in a stable order.
  #
  # The corpus cannot name an entity - it is shared by SDKs with none in
  # common - so the runner finds them here. An entity accessor is a
  # capitalised client method whose result answers get_name.
  def candidates(client)
    found = {}
    client.public_methods(false).each do |m|
      name = m.to_s
      next unless name[0] =~ /[A-Z]/
      ent = begin
        client.public_send(m)
      rescue StandardError
        next
      end
      next unless ent.respond_to?(:get_name)
      entname = begin
        ent.get_name
      rescue StandardError
        next
      end
      next unless entname.is_a?(String) && !entname.empty?
      found[entname] = [name, ent]
    end

    out = []
    found.keys.sort.each do |entname|
      accessor, ent = found[entname]
      FEATURE_CORPUS_OPS.each do |opname|
        next unless ent.respond_to?(opname)
        out << { "key" => "#{entname}.#{opname}", "accessor" => accessor, "op" => opname }
      end
    end

    # SAFE OPS FIRST - see the ts harness for the reasoning: the cache stores
    # only successful GETs, so an SDK whose first usable op is a `create`
    # (POST) can never satisfy "a hit served from cache costs nothing".
    safe = { "list" => 0, "load" => 1 }
    out.sort_by { |o| [safe.fetch(o["op"], 2), o["key"]] }
  end

  def invoke(client, op, ctrl)
    client.public_send(op["accessor"]).public_send(op["op"], {}, ctrl)
  end

  # Pick operations by DRIVING them: an op is usable when it completes
  # against a plain 200 with no feature active. Declared operations are not
  # all callable with no arguments, and a case failing for that reason would
  # read as a feature defect.
  def usable_ops(want)
    picked = []
    candidates(build_client({})).each do |cand|
      begin
        invoke(build_client({}), cand, {})
      rescue StandardError
        next
      end
      picked << cand
      break if picked.length >= want
    end
    picked
  end

  # Replace #OPn throughout a case, keys included.
  def resolve(node, tokens)
    case node
    when String
      out = node.dup
      tokens.each { |tok, val| out = out.gsub(tok, val) }
      out
    when Array
      node.map { |n| resolve(n, tokens) }
    when Hash
      node.each_with_object({}) { |(k, v), h| h[resolve(k, tokens)] = resolve(v, tokens) }
    else
      node
    end
  end

  # The highest #OPn a case mentions.
  def tokens_used(kase)
    JSON.generate(kase).scan(/#OP(\d+)/).flatten.map(&:to_i).max || 0
  end

  def member(actual, key)
    return [nil, false] if actual.nil?
    return [actual[key], true] if actual.is_a?(Hash) && actual.key?(key)
    return [actual.public_send(key), true] if actual.respond_to?(key)
    [nil, false]
  end

  # Assert that `actual` contains `expect`, recursively. Cases assert only
  # the fields they are about, so a full equality check would force every
  # case to restate the whole record.
  def subset(actual, expect, path)
    if expect.is_a?(Hash)
      expect.each do |k, want|
        got, found = member(actual, k)
        assert found, "#{path}.#{k}: no such member"
        subset(got, want, "#{path}.#{k}")
      end
      return
    end

    if expect.is_a?(Numeric)
      assert actual.is_a?(Numeric), "#{path}: expected a number, got #{actual.inspect}"
      # Money is float arithmetic; compare with a tolerance far below any
      # amount a case states.
      assert (actual.to_f - expect.to_f).abs < 1e-9,
             "#{path}: got #{actual.inspect}, want #{expect.inspect}"
      return
    end

    assert_equal expect, actual, path
  end

  def record(client, name)
    # A corpus key is any manifest item name, so it may carry characters
    # (foo-bar, foo.2) that cannot form a Ruby instance-variable name. The
    # probe uses this lookup to SKIP such a section, so answer nil rather
    # than letting instance_variable_get raise NameError for a feature this
    # SDK could never have stored under that name anyway.
    return nil unless name.match?(/\A[A-Za-z0-9_]+\z/)

    client.instance_variable_get(:"@_#{name}")
  end

  def test_corpus_carries_a_feature_section
    # A corpus with no `feature` section is a SKIP, not a failure. Each
    # project carries its OWN materialised copy of .sdk/test/test.json, so a
    # project scaffolded before the section existed legitimately has no cases
    # to run - and a hard assertion here turned that into a red suite in every
    # SDK on the fleet, for a corpus the project had simply not re-pulled yet.
    # The strict check belongs where the corpus is CONTROLLED: sdkgen's own
    # end-to-end lane supplies one and requires the cases to actually run.
    if corpus["feature"].nil?
      skip("this project's test.json has no `feature` section - recompile " \
           "the corpus (create-sdkgen .sdk/test/feature/) to run these cases")
    end
  end

  # At least one operation, or every case would skip and this suite would
  # report green having run nothing.
  def test_sdk_has_an_operation_the_corpus_can_drive
    refute_empty usable_ops(2),
                 "no declared operation completed against a plain 200 - the " \
                 "corpus cannot exercise a feature without one"
  end

  def test_feature_corpus
    (corpus["feature"] || {}).keys.sort.each do |name|
      section = (corpus["feature"] || {})[name]
      next if section.nil?

      cases = ((section["basic"] || {})["set"]) || []
      refute_empty cases,
                   "corpus section feature.#{name} ran ZERO cases - a renamed " \
                   "section or an emptied fixture must fail loudly"

      # Probed by ACTIVATING it: the feature defaults to inactive, so an idle
      # client never builds it and its absence says nothing.
      probe = build_client({ "feature" => [{ "name" => name, "active" => true }] })
      next if record(probe, name).nil?

      ops = usable_ops(2)
      by_key = ops.each_with_object({}) { |o, h| h[o["key"]] = o }

      ran = 0
      cases.each do |raw|
        need = tokens_used(raw)
        next if need > ops.length

        tokens = {}
        need.times { |i| tokens["#OP#{i + 1}"] = ops[i]["key"] }
        kase = resolve(raw, tokens)

        client = build_client(kase)
        label = kase["name"]

        (kase["op"] || []).each do |step|
          op = by_key[step["op"]]
          refute_nil op, "#{label}: no operation #{step['op']}"
          ctrl = step["ctrl"] || {}
          wanterr = step["err"]

          begin
            invoke(client, op, ctrl)
            assert_nil wanterr, "#{label}: #{step['op']} was expected to fail, and did not"
          rescue Minitest::Assertion
            raise
          rescue StandardError => e
            refute_nil wanterr, "#{label}: #{step['op']} failed unexpectedly: #{e}"
            if wanterr.is_a?(String)
              # The CODE, not the message: make_error prefixes and humanises
              # the text, so matching it would pass on any error that
              # happened to mention the word.
              code = e.respond_to?(:code) ? e.code : nil
              assert_equal wanterr, code,
                           "#{label}: wrong error code (#{e})"
            end
          end
        end

        subset(record(client, name), kase["out"], "#{label}: _#{name}")
        ran += 1
      end

      assert ran > 0, "every feature.#{name} case was skipped"
      # Say how many ran. A partial run is legitimate (an SDK with one
      # operation skips the cases needing two) but it should be visible
      # rather than inferred from a green tick.
      puts "feature.#{name}: ran #{ran} of #{cases.length} case(s) " \
           "against #{ops.length} operation(s)"
    end
  end
end
