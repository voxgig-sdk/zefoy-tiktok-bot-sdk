# ZefoyTiktokBot SDK — README example snippet tests.
#
# Guards the Ruby code examples in the package README against drift. Reads
# ../README.md, extracts every fenced ruby block, and checks each:
#
#   1. SYNTAX — runs 'ruby -c' on every block. Proves every documented Ruby
#      example parses.
#   2. RUN — offline test-mode snippets (those that construct a client via
#      .test(...) AND perform an entity operation load/list/create/update/
#      remove) are executed against the real SDK. test swaps in an in-memory
#      mock transport, so the block runs offline; it must complete without
#      raising. Signature-only snippets (e.g. .test(testopts, sdkopts)) are
#      syntax-checked but not executed.
#
# Ruby is dynamically typed, so syntax + running the offline snippets is the
# strongest check available without a live server.

require "minitest/autorun"
require "tempfile"
require "open3"

class ReadmeExamplesTest < Minitest::Test
  README = File.join(__dir__, "..", "README.md")
  SDK = File.join(__dir__, "..", "ZefoyTiktokBot_sdk.rb")

  # Extract every fenced ruby block from the package README.
  def ruby_blocks
    src = File.read(README)
    fence = (96.chr) * 3
    src.scan(/#{fence}ruby\r?\n(.*?)#{fence}/m).map { |a| a[0] }
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
        failures << "block ##{i}:\n#{out}\n#{block}" unless status.success?
      end
    end
    assert_equal [], failures, "README ruby blocks with syntax errors:\n#{failures.join("\n\n")}"
  end

  # Offline test-mode snippets must run without raising. A snippet qualifies
  # when it builds a test client (.test(...)) and calls an entity operation;
  # it is executed in a subprocess against the real SDK (mock transport, no
  # network). Snippets that only show a signature are skipped.
  def test_ruby_testmode_snippets_run
    ran = 0
    failures = []
    ruby_blocks.each_with_index do |block, i|
      is_test = block =~ /\.test\b/
      has_op = block =~ /\.(load|list|create|update|remove)\b/
      next unless is_test && has_op
      ran += 1
      runner = "require_relative #{SDK.inspect}\n" + block
      Tempfile.create(["readme_run_", ".rb"]) do |f|
        f.write(runner)
        f.flush
        out, status = Open3.capture2e("ruby", f.path)
        failures << "block ##{i} (exit #{status.exitstatus}):\n#{out}\n#{block}" unless status.success?
      end
    end
    assert_operator ran, :>, 0, "expected at least one offline test-mode snippet to run"
    assert_equal [], failures, "README test-mode snippets that raised:\n#{failures.join("\n\n")}"
  end
end
