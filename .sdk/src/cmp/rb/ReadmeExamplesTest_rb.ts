
import { cmp, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits test/readme_examples_test.rb — a Minitest suite that guards the Ruby
// code examples in the package docs against drift. It reads ../README.md and
// ../REFERENCE.md, extracts every fenced ruby block, and:
//
//   1. syntax-checks each block with `ruby -c`;
//   2. EXECUTES every runnable block (one that performs an entity operation)
//      offline in test mode against the real SDK, and fails on any real
//      Ruby-level error (undefined method, wrong-arg-count, NameError, ...).
//
// A runnable block is rewritten so its client is a test-mode client
// (<Sdk>SDK.test) seeded with an in-memory fixture for every entity it
// references — any real .new/.test constructor is rewritten, and a block that
// only *uses* `client` (constructed in an earlier fenced block) gets a test
// client prepended. This is what turns the previously syntax-only "live"
// examples into executed ones, catching bugs such as a `list` that could not
// be called with no argument.
//
// The emitted Ruby builds the ``` fence via 96.chr and shells out via Open3,
// so this generator string contains no backticks of its own.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const sdkfile = model.const.Name + '_sdk.rb'

  // Entity accessor (client.<Name>) => fixture storage key (lowercase name),
  // derived from the model so fixtures seed under the key the mock expects.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const entityLines = Object.values(entity)
    .filter((e: any) => e && e.active !== false)
    .map((e: any) => `    ${JSON.stringify(e.Name)} => ${JSON.stringify(e.name)},`)
    .join('\n')

  File({ name: 'readme_examples_test.' + target.ext }, () => {
    Content(`# ${model.const.Name} SDK — README + REFERENCE example snippet tests.
#
# Guards the Ruby code examples in the package docs against drift. Reads
# ../README.md and ../REFERENCE.md, extracts every fenced ruby block, and
# checks each:
#
#   1. SYNTAX — runs 'ruby -c' on every block. Proves every documented Ruby
#      example parses.
#   2. RUN — every runnable block (one that performs an entity operation
#      load/list/create/update/remove) is EXECUTED offline against the real
#      SDK. Each such block is rewritten to build a test-mode client
#      (${model.const.Name}SDK.test) seeded with an in-memory fixture for every
#      entity it references, so it runs without a live server. A block that
#      only uses 'client' (constructed in an earlier block) gets a test client
#      prepended. Execution must not raise a real Ruby-level error (undefined
#      method, wrong number of arguments, NameError, ...); expected not-found
#      domain errors are tolerated.
#
# Ruby is dynamically typed, so syntax + actually running every example is the
# strongest check available without a live server.

require "minitest/autorun"
require "tempfile"
require "open3"

class ReadmeExamplesTest < Minitest::Test
  README = File.join(__dir__, "..", "README.md")
  REFERENCE = File.join(__dir__, "..", "REFERENCE.md")
  SDK = File.join(__dir__, "..", "${sdkfile}")
  SDK_CLASS = "${model.const.Name}SDK"

  # Entity accessor (client.<Name>) => fixture storage key (lowercase name).
  ENTITIES = {
${entityLines}
  }

  # Ruby-level errors that indicate a real bug in a documented example (as
  # opposed to an expected not-found / domain error, which is tolerated).
  FATAL = /NoMethodError|NameError|ArgumentError|undefined method|undefined local variable|uninitialized constant|wrong number of arguments/

  # Extract every fenced ruby block from the package README and REFERENCE.
  def ruby_blocks
    fence = (96.chr) * 3
    [README, REFERENCE].flat_map do |doc|
      File.read(doc).scan(/#{fence}ruby\\r?\\n(.*?)#{fence}/m).map { |a| a[0] }
    end
  end

  def test_readme_has_ruby_examples
    refute_empty ruby_blocks, "README should contain ruby examples"
  end

  # Every ruby block must parse (ruby -c).
  def test_ruby_snippets_have_valid_syntax
    failures = []
    ruby_blocks.each_with_index do |block, i|
      Tempfile.create(["readme_rb_", ".rb"]) do |f|
        f.write(block)
        f.flush
        out, status = Open3.capture2e("ruby", "-c", f.path)
        failures << "block ##{i}:\\n#{out}\\n#{block}" unless status.success?
      end
    end
    assert_equal [], failures, "README ruby blocks with syntax errors:\\n#{failures.join("\\n\\n")}"
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

  # Rewrite a runnable block into an executable offline test-mode program: any
  # real client constructor (.new/.test) becomes <Sdk>SDK.test(<fixtures>); a
  # block that only uses 'client' gets such a constructor prepended. (The
  # constructor arg-list match is deliberately shallow — it does not span
  # nested parens — because runnable op blocks never build a client inline
  # with a lambda/closure argument.)
  def to_runner(block)
    fixtures = fixtures_literal(block)
    ctor_re = /#{Regexp.escape(SDK_CLASS)}\\.(?:new|test)(?:\\([^()]*\\))?/
    body =
      if block =~ /#{Regexp.escape(SDK_CLASS)}\\.(?:new|test)\\b/
        block.gsub(ctor_re) { "#{SDK_CLASS}.test(#{fixtures})" }
      else
        "client = #{SDK_CLASS}.test(#{fixtures})\\n" + block
      end
    "require_relative #{SDK.inspect}\\n" + body
  end

  # Every runnable block (one that performs an entity operation) is executed
  # offline in test mode and must not raise a real Ruby-level error — even one
  # an error-handling example swallows in a rescue and prints: the captured
  # output is scanned for FATAL either way, so a programming error in a
  # documented begin/rescue cannot slip through. Snippets that only illustrate a
  # signature or non-entity call are syntax-checked but not executed here.
  def test_ruby_examples_run_offline
    ran = 0
    failures = []
    ruby_blocks.each_with_index do |block, i|
      next unless block =~ /\\.(?:load|list|create|update|remove)\\b/
      ran += 1
      Tempfile.create(["readme_run_", ".rb"]) do |f|
        f.write(to_runner(block))
        f.flush
        out, status = Open3.capture2e("ruby", f.path)
        # A programming error counts whether it escapes (non-zero exit) or is
        # swallowed by an error-handling example's rescue and printed: scan the
        # captured output for it either way. Expected domain errors (e.g.
        # "404: Not found") never match FATAL, so caught not-found cases stay
        # tolerated.
        if out =~ FATAL
          failures << "block ##{i} (exit #{status.exitstatus}):\\n#{out}\\n#{block}"
        end
      end
    end
    assert_operator ran, :>, 0, "expected at least one runnable example to execute"
    assert_equal [], failures, "README examples raised a real error when run offline:\\n#{failures.join("\\n\\n")}"
  end
end
`)
  })
})


export {
  ReadmeExamplesTest
}
