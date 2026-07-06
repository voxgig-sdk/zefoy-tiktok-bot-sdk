
import { cmp, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits test/ReadmeExamplesTest.php — a PHPUnit suite that guards the PHP
// code examples in the package docs against drift. It reads ../README.md and
// ../REFERENCE.md, extracts every fenced php block, and:
//
//   1. syntax-checks each block with `php -l` (prepending <?php when absent);
//   2. EXECUTES every runnable block (one that performs an entity operation)
//      offline in test mode against the real SDK, and fails on any real
//      PHP-level error (call to undefined method, wrong-arg-count, TypeError,
//      ...).
//
// A runnable block is rewritten so its client is a test-mode client
// (<Sdk>SDK::test) seeded with an in-memory fixture for every entity it
// references — any real `new <Sdk>SDK`/`<Sdk>SDK::test` constructor is
// rewritten, and a block that only *uses* $client (constructed in an earlier
// fenced block) gets a test client prepended. This is what turns the
// previously syntax-only "live" examples into executed ones.
//
// The emitted PHP builds the ``` fence via chr(96) so this generator string
// contains no backticks of its own.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const sdkfile = model.const.Name.toLowerCase() + '_sdk.php'

  // Entity accessor ($client->Name()) => fixture storage key (lowercase name),
  // derived from the model so fixtures seed under the key the mock expects.
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const entityLines = Object.values(entity)
    .filter((e: any) => e && e.active !== false)
    .map((e: any) => `        ${JSON.stringify(e.Name)} => ${JSON.stringify(e.name)},`)
    .join('\n')

  File({ name: 'ReadmeExamplesTest.' + target.ext }, () => {
    Content(`<?php
declare(strict_types=1);

// ${model.const.Name} SDK — README + REFERENCE example snippet tests.
//
// Guards the PHP code examples in the package docs against drift. Reads
// ../README.md and ../REFERENCE.md, extracts every fenced php block, and
// checks each:
//
//   1. SYNTAX — runs 'php -l' on every block (a leading <?php is prepended
//      when the snippet omits one). Proves every documented PHP example
//      parses.
//   2. RUN — every runnable block (one that performs an entity operation
//      load/list/create/update/remove) is EXECUTED offline against the real
//      SDK. Each such block is rewritten to build a test-mode client
//      (${model.const.Name}SDK::test) seeded with an in-memory fixture for
//      every entity it references, so it runs without a live server. A block
//      that only uses \\$client (constructed in an earlier block) gets a test
//      client prepended. Execution must not raise a real PHP-level error
//      (undefined method, wrong-arg-count, TypeError, ...); expected
//      not-found domain errors are tolerated.
//
// PHP is dynamically typed, so syntax + actually running every example is the
// strongest check available without a live server.

require_once __DIR__ . '/../${sdkfile}';

use PHPUnit\\Framework\\TestCase;

class ReadmeExamplesTest extends TestCase
{
    private const SDK_CLASS = '${model.const.Name}SDK';

    // Entity accessor (\\$client->Name()) => fixture storage key (lowercase name).
    private const ENTITIES = [
${entityLines}
    ];

    // PHP-level errors that indicate a real bug in a documented example (as
    // opposed to an expected not-found / domain error, which is tolerated).
    private const FATAL = '/(Call to undefined method|Call to undefined function|Call to a member function|ArgumentCountError|Too few arguments|Undefined constant|Uncaught TypeError)/';

    /** Extract every fenced php block from the package README and REFERENCE. */
    private function phpBlocks(): array
    {
        $fence = str_repeat(chr(96), 3);
        $pattern = '/' . $fence . 'php\\r?\\n(.*?)' . $fence . '/s';
        $blocks = [];
        foreach (['README.md', 'REFERENCE.md'] as $doc) {
            $path = __DIR__ . '/../' . $doc;
            $this->assertFileExists($path);
            preg_match_all($pattern, file_get_contents($path), $m);
            foreach ($m[1] as $b) {
                $blocks[] = $b;
            }
        }
        return $blocks;
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
            $code = preg_match('/^\\s*<\\?php/', $block) ? $block : "<?php\\n" . $block;
            $tmp = tempnam(sys_get_temp_dir(), 'readme_php_') . '.php';
            file_put_contents($tmp, $code);
            $out = [];
            $rc = 0;
            exec('php -l ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            if ($rc !== 0) {
                $failures[] = 'block #' . $i . ":\\n" . implode("\\n", $out) . "\\n" . $block;
            }
        }
        $this->assertSame([], $failures, "README php blocks with syntax errors:\\n" . implode("\\n\\n", $failures));
    }

    /**
     * Build the SDK 'entity' fixture option for the entities a block
     * references, falling back to seeding all entities when none are named.
     */
    private function fixturesFor(string $block): array
    {
        $refs = [];
        foreach (self::ENTITIES as $name => $storage) {
            if (preg_match('/\\$client->' . preg_quote($name, '/') . '\\b/', $block)) {
                $refs[$storage] = ["test01" => ["id" => "test01"]];
            }
        }
        if (empty($refs)) {
            foreach (self::ENTITIES as $storage) {
                $refs[$storage] = ["test01" => ["id" => "test01"]];
            }
        }
        return ["entity" => $refs];
    }

    /**
     * Rewrite a runnable block into an executable offline test-mode program:
     * any real client constructor (new <Sdk>SDK/<Sdk>SDK::test) becomes
     * <Sdk>SDK::test(<fixtures>); a block that only uses \\$client gets such a
     * constructor prepended. (The constructor arg-list match is deliberately
     * shallow — it does not span nested parens — because runnable op blocks
     * never build a client inline with a closure argument.)
     */
    private function toRunner(string $block, string $sdk): string
    {
        $cls = self::SDK_CLASS;
        $fixtures = var_export($this->fixturesFor($block), true);
        $body = preg_replace('/^\\s*<\\?php\\s*/', '', $block);
        $ctorRe = '/(?:new\\s+' . preg_quote($cls, '/') . '|' . preg_quote($cls, '/') . '::test)(?:\\([^()]*\\))?/';
        if (preg_match($ctorRe, $body)) {
            $body = preg_replace_callback($ctorRe, function () use ($cls, $fixtures) {
                return $cls . '::test(' . $fixtures . ')';
            }, $body);
        } else {
            $body = '$client = ' . $cls . '::test(' . $fixtures . ");\\n" . $body;
        }
        return "<?php\\nrequire_once " . var_export($sdk, true) . ";\\n" . $body;
    }

    /**
     * Every runnable block (one that performs an entity operation) is executed
     * offline in test mode and must not raise a real PHP-level error — even one
     * an error-handling example swallows in a catch (Throwable) and echoes via
     * getMessage(): the captured output is scanned for FATAL either way, so a
     * programming error in a documented try/catch cannot slip through. Snippets
     * that only illustrate a signature or non-entity call are syntax-checked
     * but not executed here.
     */
    public function test_php_examples_run_offline(): void
    {
        $ran = 0;
        $failures = [];
        $sdk = __DIR__ . '/../${sdkfile}';
        foreach ($this->phpBlocks() as $i => $block) {
            if (preg_match('/->(?:load|list|create|update|remove)\\s*\\(/', $block) !== 1) {
                continue;
            }
            $ran++;
            $runner = $this->toRunner($block, $sdk);
            $tmp = tempnam(sys_get_temp_dir(), 'readme_run_') . '.php';
            file_put_contents($tmp, $runner);
            $out = [];
            $rc = 0;
            exec('php ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            $text = implode("\\n", $out);
            // A programming error counts whether it escapes (non-zero exit) or
            // is swallowed by an error-handling example's catch (Throwable) and
            // echoed via getMessage(): scan the captured output for it either
            // way. Expected domain errors (e.g. "404: Not found") never match
            // FATAL, so caught not-found cases stay tolerated.
            if (preg_match(self::FATAL, $text) === 1) {
                $failures[] = 'block #' . $i . ' (exit ' . $rc . "):\\n" . $text . "\\n" . $block;
            }
        }
        $this->assertGreaterThan(0, $ran, 'expected at least one runnable example to execute');
        $this->assertSame([], $failures, "README examples raised a real error when run offline:\\n" . implode("\\n\\n", $failures));
    }
}
`)
  })
})


export {
  ReadmeExamplesTest
}
