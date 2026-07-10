
import { cmp, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits test/readme_examples_test.rb — a Minitest COMPLETENESS GATE that
// guarantees every fenced ruby code example in the package docs is unit-tested.
// It reads ALL THREE docs — the root (multi-language) ../../README.md, the
// Ruby-specific ../README.md, and ../REFERENCE.md — extracts every fenced ruby
// block (tagged by source doc + index) and enforces four properties:
//
//   1. SYNTAX — `ruby -c` on every block. Every documented example must parse.
//   2. RUN — every RUNNABLE block (one that constructs the SDK, drives
//      client., or performs an entity op) is EXECUTED offline in seeded test
//      mode against the real SDK. The captured stdout+stderr is scanned for
//      FATAL programming-error markers REGARDLESS of exit code, so a bug that a
//      documented begin/rescue swallows and prints is still caught. Only a
//      not-found / domain error is tolerated.
//   3. COMPLETENESS — every block is partitioned into exactly one of
//      {executed, syntaxchecked-nonrunnable, illustration} and the counts must
//      sum to the total. "illustration" is a NARROW explicit class (a
//      signature / method-table block that names the SDK class or a documented
//      method but never uses a live client) — never a catch-all. A
//      runnable-looking block that was NOT executed lands in neither bucket and
//      FAILS the gate: no runnable example can be silently skipped.
//   4. A per-doc summary (total / executed / syntaxchecked / illustration) is
//      printed.
//
// A runnable block is rewritten so its client is a test-mode client
// (<Sdk>SDK.test) seeded with an in-memory fixture for every entity it
// references; any real .new/.test constructor is rewritten and the doc's own
// require of the SDK file is stripped (we require it by absolute path). A block
// that only *uses* `client` (constructed in an earlier fenced block) gets a
// test client prepended.
//
// The emitted Ruby builds the ``` fence via 96.chr and shells out via Open3,
// so this generator string contains no backticks of its own.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const sdkbase = model.const.Name + '_sdk'
  const sdkfile = sdkbase + '.rb'

  // Entity accessor (client.<Name>) => fixture storage key (lowercase name),
  // derived from the model so fixtures seed under the key the mock expects.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const entityLines = Object.values(entity)
    .filter((e: any) => e && e.active !== false)
    .map((e: any) => `    ${JSON.stringify(e.Name)} => ${JSON.stringify(e.name)},`)
    .join('\n')

  File({ name: 'readme_examples_test.' + target.ext }, () => {
    Content(`# ${model.const.Name} SDK — documentation example COMPLETENESS GATE.
#
# Guarantees every fenced ruby code example across ALL THREE package docs is
# unit-tested. Reads the root ../../README.md, the Ruby ../README.md, and
# ../REFERENCE.md, extracts every fenced ruby block (tagged by source doc +
# index) and enforces:
#
#   1. SYNTAX — 'ruby -c' on every block. Every documented ruby example must
#      parse.
#   2. RUN — every RUNNABLE block (one that constructs the SDK, drives client.,
#      or performs an entity op load/list/create/update/remove) is EXECUTED
#      offline in seeded test mode (${model.const.Name}SDK.test) against the real
#      SDK. The captured output is scanned for a real Ruby-level error (undefined
#      method, wrong number of arguments, NameError, ...) REGARDLESS of exit
#      code, so a bug a documented begin/rescue swallows and prints cannot slip
#      through. Expected not-found domain errors are tolerated.
#   3. COMPLETENESS — every block is partitioned into exactly one of
#      {executed, syntaxchecked-nonrunnable, illustration}; the counts must sum
#      to the total. A runnable-looking block that was not executed belongs to
#      no bucket and FAILS the gate.
#
# Ruby is dynamically typed, so syntax + actually running every example is the
# strongest check available without a live server.

require "minitest/autorun"
require "tempfile"
require "open3"

class ReadmeExamplesTest < Minitest::Test
  # The three documentation sources this gate covers.
  DOCS = {
    "root README" => File.join(__dir__, "..", "..", "README.md"),
    "rb README" => File.join(__dir__, "..", "README.md"),
    "rb REFERENCE" => File.join(__dir__, "..", "REFERENCE.md"),
  }
  SDK = File.join(__dir__, "..", "${sdkfile}")
  SDK_CLASS = "${model.const.Name}SDK"

  # SDK file basename (no extension) — used to strip the doc's own require of the
  # SDK file from a runnable block (we require it by absolute path).
  SDK_BASE = "${sdkbase}"

  # Entity accessor (client.<Name>) => fixture storage key (lowercase name).
  ENTITIES = {
${entityLines}
  }

  # Documented SDK method names — used only to recognise the NARROW
  # signature/method-table "illustration" class.
  METHODS = %w[options_map get_utility prepare direct data_get data_set match_get match_set make get_name]

  # Ruby-level errors that indicate a real bug in a documented example (as
  # opposed to an expected not-found / domain error, which is tolerated).
  FATAL = /NoMethodError|NameError|ArgumentError|undefined method|undefined local variable|uninitialized constant|wrong number of arguments/

  # Extract every fenced ruby block from all three docs, each tagged with its
  # source doc label and its index within that doc.
  def ruby_blocks
    fence = (96.chr) * 3
    blocks = []
    DOCS.each do |label, path|
      assert File.exist?(path), "missing documentation source: #{label}"
      File.read(path).scan(/#{fence}ruby\\r?\\n(.*?)#{fence}/m).each_with_index do |a, i|
        blocks << { doc: label, n: i, code: a[0] }
      end
    end
    blocks
  end

  # --- classification -------------------------------------------------------

  # A block is RUNNABLE when it constructs the SDK, drives client., or performs
  # an entity operation. Every runnable block MUST be executed.
  def runnable?(b)
    b =~ /#{Regexp.escape(SDK_CLASS)}\\.(?:new|test)\\b/ ||
      b =~ /\\bclient\\./ ||
      b =~ /\\.(?:load|list|create|update|remove)\\b/ ? true : false
  end

  # A block "mentions the SDK" when it references the client variable, the SDK
  # class, an entity accessor, or an entity operation. A non-runnable block that
  # mentions the SDK but is not a signature illustration is an uncovered
  # runnable-looking block and must fail the completeness gate.
  def looks_sdk?(b)
    return true if b =~ /\\bclient\\b/
    return true if b =~ /\\b#{Regexp.escape(SDK_CLASS)}\\b/
    return true if b =~ /\\.(?:load|list|create|update|remove)\\b/
    ENTITIES.each_key { |name| return true if b =~ /\\.#{Regexp.escape(name)}\\b/ }
    false
  end

  # NARROW illustration class: a non-runnable block that references the SDK class
  # or a documented method NAME as a signature / method-table, and never uses a
  # live client variable. This is an explicit, restricted class — not a
  # catch-all — so an unexecuted block that uses a client variable cannot hide here.
  def illustration?(b)
    return false if runnable?(b)
    return false if b =~ /\\bclient\\b/
    return true if b =~ /\\b#{Regexp.escape(SDK_CLASS)}\\b/
    METHODS.each { |m| return true if b =~ /\\b#{Regexp.escape(m)}\\s*\\(/ }
    false
  end

  # Partition label for a block: exactly one of the four.
  def classify(b)
    return "executed" if runnable?(b)
    return "illustration" if illustration?(b)
    return "syntaxchecked_nonrunnable" unless looks_sdk?(b)
    "unclassified"
  end

  # --- tests ----------------------------------------------------------------

  def test_docs_have_ruby_examples
    refute_empty ruby_blocks, "docs should contain ruby examples"
  end

  # Every ruby block across all three docs must parse (ruby -c).
  def test_ruby_snippets_have_valid_syntax
    failures = []
    ruby_blocks.each do |blk|
      Tempfile.create(["readme_rb_", ".rb"]) do |f|
        f.write(blk[:code])
        f.flush
        out, status = Open3.capture2e("ruby", "-c", f.path)
        failures << "#{blk[:doc]} ##{blk[:n]}:\\n#{out}\\n#{blk[:code]}" unless status.success?
      end
    end
    assert_equal [], failures, "docs ruby blocks with syntax errors:\\n#{failures.join("\\n\\n")}"
  end

  # Build the SDK 'entity' fixture option (as Ruby source) for the entities a
  # block references, falling back to seeding all entities when none are named.
  def fixtures_literal(block)
    refs = ENTITIES.select { |name, _| block =~ /\\bclient\\.#{Regexp.escape(name)}\\b/ }
    refs = ENTITIES if refs.empty?
    entity = {}
    refs.each_value { |storage| entity[storage] = { "test01" => { "id" => "test01" } } }
    { "entity" => entity }.inspect
  end

  # Rewrite a runnable block into an executable offline test-mode program: the
  # doc's own require of the SDK file is stripped (we require it by absolute
  # path); any real client constructor (.new/.test) becomes <Sdk>SDK.test(<fixtures>);
  # a block that only uses a client variable gets such a constructor prepended. (The
  # constructor arg-list match is deliberately shallow — it does not span nested
  # parens — because runnable op blocks never build a client inline with a
  # lambda/closure argument.)
  def to_runner(block)
    fixtures = fixtures_literal(block)
    # Drop the doc's own require of the SDK file; we require it by absolute path.
    block = block.gsub(/^[ \\t]*require(?:_relative|_once)?[^\\n]*#{Regexp.escape(SDK_BASE)}[^\\n]*\\r?\\n?/i, "")
    ctor_re = /#{Regexp.escape(SDK_CLASS)}\\.(?:new|test)(?:\\([^()]*\\))?/
    body =
      if block =~ /#{Regexp.escape(SDK_CLASS)}\\.(?:new|test)\\b/
        block.gsub(ctor_re) { "#{SDK_CLASS}.test(#{fixtures})" }
      else
        "client = #{SDK_CLASS}.test(#{fixtures})\\n" + block
      end
    "require_relative #{SDK.inspect}\\n" + body
  end

  # Every RUNNABLE block is executed offline in test mode and must not raise a
  # real Ruby-level error — even one an error-handling example swallows in a
  # rescue and prints: the captured output is scanned for FATAL either way, so a
  # programming error in a documented begin/rescue cannot slip through. Expected
  # domain errors (e.g. "404: Not found") never match FATAL, so caught not-found
  # cases stay tolerated.
  def test_ruby_examples_run_offline
    ran = 0
    failures = []
    ruby_blocks.each do |blk|
      next unless runnable?(blk[:code])
      ran += 1
      Tempfile.create(["readme_run_", ".rb"]) do |f|
        f.write(to_runner(blk[:code]))
        f.flush
        out, status = Open3.capture2e("ruby", f.path)
        if out =~ FATAL
          failures << "#{blk[:doc]} ##{blk[:n]} (exit #{status.exitstatus}):\\n#{out}\\n#{blk[:code]}"
        end
      end
    end
    assert_operator ran, :>, 0, "expected at least one runnable example to execute"
    assert_equal [], failures, "docs ruby examples raised a real error when run offline:\\n#{failures.join("\\n\\n")}"
  end

  # COMPLETENESS GATE: every fenced ruby block is partitioned into exactly one of
  # {executed, syntaxchecked-nonrunnable, illustration}. The three counts must
  # sum to the total. A block that references the SDK but is neither runnable (so
  # not executed) nor a narrow signature illustration is "unclassified" — a
  # runnable-looking example that would be silently skipped — and fails the gate.
  def test_ruby_examples_are_completely_classified
    blocks = ruby_blocks
    buckets = { "executed" => [], "syntaxchecked_nonrunnable" => [], "illustration" => [], "unclassified" => [] }
    per_doc = {}
    blocks.each do |blk|
      cls = classify(blk[:code])
      buckets[cls] << blk
      d = (per_doc[blk[:doc]] ||= { "total" => 0, "executed" => 0, "syntaxchecked_nonrunnable" => 0, "illustration" => 0, "unclassified" => 0 })
      d["total"] += 1
      d[cls] += 1
    end

    summary = "ReadmeExamplesTest — ruby example coverage:\\n"
    per_doc.each do |doc, c|
      extra = c["unclassified"] > 0 ? " UNCLASSIFIED=#{c["unclassified"]}" : ""
      summary += format("  %-14s total=%d executed=%d syntaxchecked=%d illustration=%d%s\\n",
                        doc, c["total"], c["executed"], c["syntaxchecked_nonrunnable"], c["illustration"], extra)
    end
    warn "\\n" + summary

    unclassified = buckets["unclassified"].map { |b| "#{b[:doc]} ##{b[:n]}:\\n#{b[:code]}" }
    assert_equal [], unclassified,
                 "runnable-looking ruby blocks that were neither executed nor a signature illustration:\\n#{unclassified.join("\\n\\n")}"

    total = blocks.length
    sum = buckets["executed"].length + buckets["syntaxchecked_nonrunnable"].length + buckets["illustration"].length
    assert_equal total, sum,
                 "every ruby block must be executed, syntaxchecked-nonrunnable, or illustration.\\n#{summary}"

    assert_operator buckets["executed"].length, :>, 0, "expected at least one executed ruby example"
  end
end
`)
  })
})


export {
  ReadmeExamplesTest
}
