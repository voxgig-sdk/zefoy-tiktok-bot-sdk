
import { cmp, File, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


// Emits test/ReadmeExamplesTest.php — a PHPUnit COMPLETENESS GATE that
// guarantees every fenced php code example in the package docs is unit-tested.
// It reads ALL THREE docs — the root (multi-language) ../../README.md, the
// PHP-specific ../README.md, and ../REFERENCE.md — extracts every fenced php
// block (tagged by source doc + index) and enforces four properties:
//
//   1. SYNTAX — `php -l` on every block (a leading <?php is prepended when the
//      snippet omits one). Every documented example must parse.
//   2. RUN — every RUNNABLE block (one that constructs the SDK, drives
//      $client->, or performs an entity op) is EXECUTED offline in seeded test
//      mode against the real SDK. The captured stdout+stderr is scanned for
//      FATAL programming-error markers REGARDLESS of exit code, so a bug that a
//      documented try/catch swallows and echoes via getMessage() is still
//      caught. Only a not-found / domain error is tolerated.
//   3. COMPLETENESS — every block is partitioned into exactly one of
//      {executed, syntaxchecked-nonrunnable, illustration} and the counts must
//      sum to the total. "illustration" is a NARROW explicit class (a
//      signature / method-table block that names the SDK class or a documented
//      method but never uses a live client) — never a catch-all. A
//      runnable-looking block that was NOT executed lands in neither bucket and
//      FAILS the gate: no runnable example can be silently skipped.
//   4. A per-doc summary (total / executed / syntaxchecked / illustration) is
//      printed to STDERR.
//
// A runnable block is rewritten so its client is a test-mode client
// (<Sdk>SDK::test) seeded with an in-memory fixture for every entity it
// references; any real constructor is rewritten and the doc's own require of
// the SDK file is stripped (we require it by absolute path). A block that only
// *uses* $client (constructed in an earlier fenced block) gets a test client
// prepended.
//
// The emitted PHP builds the ``` fence via chr(96) so this generator string
// contains no backticks of its own.
const ReadmeExamplesTest = cmp(function ReadmeExamplesTest(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const sdkbase = model.const.Name.toLowerCase() + '_sdk'
  const sdkfile = sdkbase + '.php'

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

// ${model.const.Name} SDK — documentation example COMPLETENESS GATE.
//
// Guarantees every fenced php code example across ALL THREE package docs is
// unit-tested. Reads the root ../../README.md, the PHP ../README.md, and
// ../REFERENCE.md, extracts every fenced php block (tagged by source doc +
// index) and enforces:
//
//   1. SYNTAX — 'php -l' on every block (a leading <?php is prepended when the
//      snippet omits one). Every documented php example must parse.
//   2. RUN — every RUNNABLE block (one that constructs the SDK, drives
//      \\$client->, or performs an entity op load/list/create/update/remove) is
//      EXECUTED offline in seeded test mode (${model.const.Name}SDK::test)
//      against the real SDK. The captured output is scanned for a real
//      PHP-level error (undefined method, wrong-arg-count, TypeError, ...)
//      REGARDLESS of exit code, so a bug a documented try/catch swallows and
//      echoes cannot slip through. Expected not-found domain errors are
//      tolerated.
//   3. COMPLETENESS — every block is partitioned into exactly one of
//      {executed, syntaxchecked-nonrunnable, illustration}; the counts must sum
//      to the total. A runnable-looking block that was not executed belongs to
//      no bucket and FAILS the gate.
//
// PHP is dynamically typed, so syntax + actually running every example is the
// strongest check available without a live server.

require_once __DIR__ . '/../${sdkfile}';

use PHPUnit\\Framework\\TestCase;

class ReadmeExamplesTest extends TestCase
{
    private const SDK_CLASS = '${model.const.Name}SDK';

    // SDK file basename (no extension) — used to strip the doc's own require of
    // the SDK file from a runnable block (we require it by absolute path).
    private const SDK_BASE = '${sdkbase}';

    // Entity accessor (\\$client->Name()) => fixture storage key (lowercase name).
    private const ENTITIES = [
${entityLines}
    ];

    // Documented SDK method names — used only to recognise the NARROW
    // signature/method-table "illustration" class.
    private const METHODS = [
        'options_map', 'get_utility', 'prepare', 'direct',
        'data_get', 'data_set', 'match_get', 'match_set', 'make', 'get_name',
    ];

    // PHP-level errors that indicate a real bug in a documented example (as
    // opposed to an expected not-found / domain error, which is tolerated).
    private const FATAL = '/(Call to undefined method|Call to undefined function|Call to a member function|ArgumentCountError|Too few arguments|Undefined constant|Uncaught TypeError)/';

    // The three documentation sources this gate covers.
    private function docs(): array
    {
        return [
            'root README' => __DIR__ . '/../../README.md',
            'php README' => __DIR__ . '/../README.md',
            'php REFERENCE' => __DIR__ . '/../REFERENCE.md',
        ];
    }

    /**
     * Extract every fenced php block from all three docs, each tagged with its
     * source doc label and its index within that doc.
     */
    private function phpBlocks(): array
    {
        $fence = str_repeat(chr(96), 3);
        $pattern = '/' . $fence . 'php\\r?\\n(.*?)' . $fence . '/s';
        $blocks = [];
        foreach ($this->docs() as $label => $path) {
            $this->assertFileExists($path, 'missing documentation source: ' . $label);
            preg_match_all($pattern, file_get_contents($path), $m);
            foreach ($m[1] as $i => $b) {
                $blocks[] = ['doc' => $label, 'n' => $i, 'code' => $b];
            }
        }
        return $blocks;
    }

    // --- classification -----------------------------------------------------

    /**
     * A block is RUNNABLE when it constructs the SDK, drives \\$client->, or
     * performs an entity operation. Every runnable block MUST be executed.
     */
    private function isRunnable(string $b): bool
    {
        $cls = preg_quote(self::SDK_CLASS, '/');
        return preg_match('/new\\s+' . $cls . '\\b/', $b) === 1
            || preg_match('/' . $cls . '::test\\b/', $b) === 1
            || preg_match('/\\$client\\s*->/', $b) === 1
            || preg_match('/->\\s*(?:load|list|create|update|remove)\\s*\\(/', $b) === 1;
    }

    /**
     * A block "mentions the SDK" when it references the client variable, the SDK
     * class, an entity accessor, or an entity operation. A non-runnable block
     * that mentions the SDK but is not a signature illustration is an uncovered
     * runnable-looking block and must fail the completeness gate.
     */
    private function looksSdk(string $b): bool
    {
        if (preg_match('/\\$client\\b/', $b) === 1) {
            return true;
        }
        if (preg_match('/\\b' . preg_quote(self::SDK_CLASS, '/') . '\\b/', $b) === 1) {
            return true;
        }
        if (preg_match('/->\\s*(?:load|list|create|update|remove)\\b/', $b) === 1) {
            return true;
        }
        foreach (array_keys(self::ENTITIES) as $name) {
            if (preg_match('/->\\s*' . preg_quote($name, '/') . '\\s*\\(/', $b) === 1) {
                return true;
            }
        }
        return false;
    }

    /**
     * NARROW illustration class: a non-runnable block that references the SDK
     * class or a documented method NAME as a signature / method-table, and never
     * uses a live client variable. This is an explicit, restricted class — not a
     * catch-all — so an unexecuted block that uses \\$client cannot hide here.
     */
    private function isIllustration(string $b): bool
    {
        if ($this->isRunnable($b)) {
            return false;
        }
        if (preg_match('/\\$client\\b/', $b) === 1) {
            return false;
        }
        if (preg_match('/\\b' . preg_quote(self::SDK_CLASS, '/') . '\\b/', $b) === 1) {
            return true;
        }
        foreach (self::METHODS as $meth) {
            if (preg_match('/\\b' . preg_quote($meth, '/') . '\\s*\\(/', $b) === 1) {
                return true;
            }
        }
        return false;
    }

    /** Partition label for a block: exactly one of the four. */
    private function classify(string $b): string
    {
        if ($this->isRunnable($b)) {
            return 'executed';
        }
        if ($this->isIllustration($b)) {
            return 'illustration';
        }
        if (!$this->looksSdk($b)) {
            return 'syntaxchecked_nonrunnable';
        }
        return 'unclassified';
    }

    // --- tests --------------------------------------------------------------

    public function test_docs_have_php_examples(): void
    {
        $this->assertNotEmpty($this->phpBlocks(), 'docs should contain php examples');
    }

    /** Every php block across all three docs must parse (php -l). */
    public function test_php_snippets_have_valid_syntax(): void
    {
        $failures = [];
        foreach ($this->phpBlocks() as $blk) {
            $block = $blk['code'];
            $code = preg_match('/^\\s*<\\?php/', $block) ? $block : "<?php\\n" . $block;
            $tmp = tempnam(sys_get_temp_dir(), 'readme_php_') . '.php';
            file_put_contents($tmp, $code);
            $out = [];
            $rc = 0;
            exec('php -l ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            if ($rc !== 0) {
                $failures[] = $blk['doc'] . ' #' . $blk['n'] . ":\\n" . implode("\\n", $out) . "\\n" . $block;
            }
        }
        $this->assertSame([], $failures, "docs php blocks with syntax errors:\\n" . implode("\\n\\n", $failures));
    }

    /**
     * Build the SDK 'entity' fixture option for the entities a block references,
     * falling back to seeding all entities when none are named.
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
     * Rewrite a runnable block into an executable offline test-mode program: the
     * doc's own require of the SDK file is stripped (we require it by absolute
     * path); any real client constructor (new <Sdk>SDK / <Sdk>SDK::test) becomes
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
        // Drop the doc's own require of the SDK file; we require it by absolute path.
        $body = preg_replace(
            '/^[ \\t]*require(?:_once)?[^\\n]*' . preg_quote(self::SDK_BASE, '/') . '[^\\n]*\\r?\\n?/mi',
            '',
            $body
        );
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
     * Every RUNNABLE block is executed offline in test mode and must not raise a
     * real PHP-level error — even one an error-handling example swallows in a
     * catch (Throwable) and echoes via getMessage(): the captured output is
     * scanned for FATAL either way, so a programming error in a documented
     * try/catch cannot slip through. Expected domain errors (e.g. "404: Not
     * found") never match FATAL, so caught not-found cases stay tolerated.
     */
    public function test_php_examples_run_offline(): void
    {
        $ran = 0;
        $failures = [];
        $sdk = __DIR__ . '/../${sdkfile}';
        foreach ($this->phpBlocks() as $blk) {
            if (!$this->isRunnable($blk['code'])) {
                continue;
            }
            $ran++;
            $runner = $this->toRunner($blk['code'], $sdk);
            $tmp = tempnam(sys_get_temp_dir(), 'readme_run_') . '.php';
            file_put_contents($tmp, $runner);
            $out = [];
            $rc = 0;
            exec('php ' . escapeshellarg($tmp) . ' 2>&1', $out, $rc);
            @unlink($tmp);
            $text = implode("\\n", $out);
            if (preg_match(self::FATAL, $text) === 1) {
                $failures[] = $blk['doc'] . ' #' . $blk['n'] . ' (exit ' . $rc . "):\\n" . $text . "\\n" . $blk['code'];
            }
        }
        $this->assertGreaterThan(0, $ran, 'expected at least one runnable example to execute');
        $this->assertSame([], $failures, "docs php examples raised a real error when run offline:\\n" . implode("\\n\\n", $failures));
    }

    /**
     * COMPLETENESS GATE: every fenced php block is partitioned into exactly one
     * of {executed, syntaxchecked-nonrunnable, illustration}. The three counts
     * must sum to the total. A block that references the SDK but is neither
     * runnable (so not executed) nor a narrow signature illustration is
     * "unclassified" — a runnable-looking example that would be silently skipped
     * — and fails the gate.
     */
    public function test_php_examples_are_completely_classified(): void
    {
        $blocks = $this->phpBlocks();
        $buckets = [
            'executed' => [],
            'syntaxchecked_nonrunnable' => [],
            'illustration' => [],
            'unclassified' => [],
        ];
        $perDoc = [];
        foreach ($blocks as $blk) {
            $cls = $this->classify($blk['code']);
            $buckets[$cls][] = $blk;
            $doc = $blk['doc'];
            if (!isset($perDoc[$doc])) {
                $perDoc[$doc] = ['total' => 0, 'executed' => 0, 'syntaxchecked_nonrunnable' => 0, 'illustration' => 0, 'unclassified' => 0];
            }
            $perDoc[$doc]['total']++;
            $perDoc[$doc][$cls]++;
        }

        $summary = "ReadmeExamplesTest — php example coverage:\\n";
        foreach ($perDoc as $doc => $c) {
            $summary .= sprintf(
                "  %-14s total=%d executed=%d syntaxchecked=%d illustration=%d%s\\n",
                $doc, $c['total'], $c['executed'], $c['syntaxchecked_nonrunnable'], $c['illustration'],
                $c['unclassified'] > 0 ? ' UNCLASSIFIED=' . $c['unclassified'] : ''
            );
        }
        fwrite(STDERR, "\\n" . $summary);

        $unclassified = array_map(
            function ($b) { return $b['doc'] . ' #' . $b['n'] . ":\\n" . $b['code']; },
            $buckets['unclassified']
        );
        $this->assertSame([], $unclassified,
            "runnable-looking php blocks that were neither executed nor a signature illustration:\\n"
            . implode("\\n\\n", $unclassified));

        $total = count($blocks);
        $sum = count($buckets['executed'])
            + count($buckets['syntaxchecked_nonrunnable'])
            + count($buckets['illustration']);
        $this->assertSame($total, $sum,
            "every php block must be executed, syntaxchecked-nonrunnable, or illustration.\\n" . $summary);

        $this->assertGreaterThan(0, count($buckets['executed']),
            'expected at least one executed php example');
    }
}
`)
  })
})


export {
  ReadmeExamplesTest
}
