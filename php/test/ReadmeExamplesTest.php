<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK — README example snippet tests.
//
// Guards the PHP code examples in the package README against drift. Reads
// ../README.md, extracts every fenced php block, and checks each:
//
//   1. SYNTAX — runs 'php -l' on every block (a leading <?php is prepended
//      when the snippet omits one). Proves every documented PHP example
//      parses.
//   2. RUN — offline test-mode snippets (those that construct a client via
//      ::test(...) AND perform an entity operation load/list/create/update/
//      remove) are executed against the real SDK. test() swaps in an
//      in-memory mock transport, so the block runs offline; it must complete
//      without throwing. Signature-only snippets (e.g. ::test(\$testopts,
//      \$sdkopts)) are syntax-checked but not executed.
//
// PHP is dynamically typed, so syntax + running the offline snippets is the
// strongest check available without a live server.

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';

use PHPUnit\Framework\TestCase;

class ReadmeExamplesTest extends TestCase
{
    /** Extract every fenced php block from the package README. */
    private function phpBlocks(): array
    {
        $readme = __DIR__ . '/../README.md';
        $this->assertFileExists($readme);
        $src = file_get_contents($readme);
        $fence = str_repeat(chr(96), 3);
        $pattern = '/' . $fence . 'php\r?\n(.*?)' . $fence . '/s';
        preg_match_all($pattern, $src, $m);
        return $m[1];
    }

    public function test_readme_has_php_examples(): void
    {
        $this->assertNotEmpty($this->phpBlocks(), 'README should contain php examples');
    }

    /** Every php block must parse (php -l). */
    public function test_php_snippets_have_valid_syntax(): void
    {
        $failures = [];
        foreach ($this->phpBlocks() as $i => $block) {
            $code = preg_match('/^\s*<\?php/', $block) ? $block : "<?php\n" . $block;
            $tmp = tempnam(sys_get_temp_dir(), 'readme_php_') . '.php';
            file_put_contents($tmp, $code);
            $out = [];
            $rc = 0;
            exec('php -l ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            if ($rc !== 0) {
                $failures[] = 'block #' . $i . ":\n" . implode("\n", $out) . "\n" . $block;
            }
        }
        $this->assertSame([], $failures, "README php blocks with syntax errors:\n" . implode("\n\n", $failures));
    }

    /**
     * Offline test-mode snippets must run without throwing. A snippet
     * qualifies when it builds a test client (::test(...)) and calls an entity
     * operation; it is executed in a subprocess against the real SDK (mock
     * transport, no network). Snippets that only show a signature are skipped.
     */
    public function test_php_testmode_snippets_run(): void
    {
        $ran = 0;
        $failures = [];
        $sdk = __DIR__ . '/../zefoytiktokbot_sdk.php';
        foreach ($this->phpBlocks() as $i => $block) {
            $isTest = strpos($block, '::test(') !== false;
            $hasOp = preg_match('/->(load|list|create|update|remove)\s*\(/', $block) === 1;
            if (!($isTest && $hasOp)) {
                continue;
            }
            $ran++;
            $body = preg_replace('/^\s*<\?php\s*/', '', $block);
            $runner = "<?php\nrequire_once " . var_export($sdk, true) . ";\n" . $body;
            $tmp = tempnam(sys_get_temp_dir(), 'readme_run_') . '.php';
            file_put_contents($tmp, $runner);
            $out = [];
            $rc = 0;
            exec('php ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            if ($rc !== 0) {
                $failures[] = 'block #' . $i . ' (exit ' . $rc . "):\n" . implode("\n", $out) . "\n" . $block;
            }
        }
        $this->assertGreaterThan(0, $ran, 'expected at least one offline test-mode snippet to run');
        $this->assertSame([], $failures, "README test-mode snippets that threw:\n" . implode("\n\n", $failures));
    }
}
