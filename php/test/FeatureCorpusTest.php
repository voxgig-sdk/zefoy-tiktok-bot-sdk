<?php

// ZefoyTiktokBot SDK feature corpus test
//
// Feature behaviour, driven by the SHARED corpus.
//
// The same route PrimaryUtilityTest.php takes for the utilities:
// language-neutral cases in .sdk/test/test.json, executed against THIS
// generated SDK. The feature is the ordinary class, built by the generated
// config, installed by the generated constructor, and driven by a real entity
// operation. Not a miniature of the pipeline, which can only be as right as
// the miniature.
//
// Everything in a case is data. The one piece php writes for itself is
// turning scripted responses into a fetcher, through the documented
// `utility.fetcher` override.

declare(strict_types=1);

require_once __DIR__ . '/../zefoytiktokbot_sdk.php';

use PHPUnit\Framework\TestCase;

class FeatureCorpusTest extends TestCase
{
    // Features with a corpus section are read from the corpus itself (see
    // testFeatureCorpus), so a project-authored section - a custom feature
    // added under .sdk/test/feature/ - runs without editing this file. An
    // SDK generated without a listed feature still skips, not fails.

    // The standard operation names, in the order the runner prefers them.
    private const FEATURE_CORPUS_OPS = ['load', 'list', 'create', 'update', 'remove'];

    private static function corpus(): array
    {
        $path = __DIR__ . '/../../.sdk/test/test.json';
        $raw = file_get_contents($path);
        if (false === $raw) {
            throw new RuntimeException("Failed to load test.json: $path");
        }
        return json_decode($raw, true);
    }

    /**
     * A scripted transport built from a case's `res` list. Responses are
     * consumed in order and the last one repeats, so a case that does not care
     * how many attempts happen need only declare one.
     *
     * Returns the shape the real fetcher returns: a [response, err] PAIR, with
     * the parsed body behind a `json` closure and `body` as the raw string. A
     * script that only set `body` would look like an empty result, which reads
     * as a feature defect rather than a mis-shaped script.
     */
    private static function scriptedFetcher($res): callable
    {
        $n = -1;
        return function ($ctx, $fullurl, $fetchdef) use ($res, &$n) {
            $n++;
            $spec = [];
            if (is_array($res) && count($res) > 0) {
                $i = $n >= count($res) ? count($res) - 1 : $n;
                $spec = $res[$i] ?? [];
            }

            if (($spec['throw'] ?? null) === true) {
                return [null, new RuntimeException('scripted transport failure')];
            }

            $status = isset($spec['status']) ? (int)$spec['status'] : 200;
            $body = $spec['body'] ?? [];

            return [
                [
                    'status' => $status,
                    'statusText' => $status < 400 ? 'OK' : 'ERR',
                    'headers' => (array)($spec['headers'] ?? []),
                    'json' => function () use ($body) { return $body; },
                    'body' => json_encode($body),
                ],
                null,
            ];
        };
    }

    /**
     * Build a client the way a caller would.
     *
     * The plain constructor, not the test-mode one: the `test` feature is
     * transport: 'base' and REPLACES the transport, so a client in test mode
     * would shadow the script.
     */
    private static function buildClient(array $kase)
    {
        $opts = ['utility' => ['fetcher' => self::scriptedFetcher($kase['res'] ?? null)]];
        if (isset($kase['feature'])) {
            $opts['feature'] = $kase['feature'];
        }
        return new ZefoyTiktokBotSDK($opts);
    }

    /**
     * Every operation this SDK declares, in a stable order.
     *
     * The corpus cannot name an entity - it is shared by SDKs with none in
     * common - so the runner finds them here. An entity accessor is a
     * capitalised client method whose result answers get_name().
     */
    private static function candidates($client): array
    {
        $found = [];
        foreach (get_class_methods($client) as $m) {
            if (!preg_match('/^[A-Z]/', $m)) {
                continue;
            }
            try {
                $ent = $client->$m();
            } catch (\Throwable $e) {
                continue;
            }
            if (!is_object($ent) || !method_exists($ent, 'get_name')) {
                continue;
            }
            try {
                $entname = $ent->get_name();
            } catch (\Throwable $e) {
                continue;
            }
            if (!is_string($entname) || '' === $entname) {
                continue;
            }
            $found[$entname] = [$m, $ent];
        }

        ksort($found);

        $out = [];
        foreach ($found as $entname => $pair) {
            [$accessor, $ent] = $pair;
            foreach (self::FEATURE_CORPUS_OPS as $opname) {
                if (method_exists($ent, $opname)) {
                    $out[] = [
                        'key' => $entname . '.' . $opname,
                        'accessor' => $accessor,
                        'op' => $opname,
                    ];
                }
            }
        }

        // SAFE OPS FIRST — see the ts harness for the reasoning: the cache
        // stores only successful GETs, so an SDK whose first usable op is a
        // `create` (POST) can never satisfy "a hit served from cache costs
        // nothing".
        $safe = ['list' => 0, 'load' => 1];
        usort($out, function ($a, $b) use ($safe) {
            $ra = $safe[$a['op']] ?? 2;
            $rb = $safe[$b['op']] ?? 2;
            return $ra === $rb ? strcmp($a['key'], $b['key']) : $ra - $rb;
        });
        return $out;
    }

    private static function invoke($client, array $op, array $ctrl)
    {
        $acc = $op['accessor'];
        $ent = $client->$acc();
        $fn = $op['op'];
        return $ent->$fn([], $ctrl);
    }

    /**
     * Pick operations by DRIVING them: an op is usable when it completes
     * against a plain 200 with no feature active. Declared operations are not
     * all callable with no arguments, and a case failing for that reason would
     * read as a feature defect.
     */
    private static function usableOps(int $want): array
    {
        $picked = [];
        foreach (self::candidates(self::buildClient([])) as $cand) {
            try {
                self::invoke(self::buildClient([]), $cand, []);
            } catch (\Throwable $e) {
                continue;
            }
            $picked[] = $cand;
            if (count($picked) >= $want) {
                break;
            }
        }
        return $picked;
    }

    /** Replace #OPn throughout a case, keys included. */
    private static function resolve($node, array $tokens)
    {
        if (is_string($node)) {
            return strtr($node, $tokens);
        }
        if (is_array($node)) {
            $out = [];
            foreach ($node as $k => $v) {
                $key = is_string($k) ? strtr($k, $tokens) : $k;
                $out[$key] = self::resolve($v, $tokens);
            }
            return $out;
        }
        return $node;
    }

    /** The highest #OPn a case mentions. */
    private static function tokensUsed(array $kase): int
    {
        preg_match_all('/#OP(\d+)/', json_encode($kase), $m);
        $nums = array_map('intval', $m[1] ?? []);
        return count($nums) > 0 ? max($nums) : 0;
    }

    private static function member($actual, string $key): array
    {
        if (null === $actual) {
            return [null, false];
        }
        if (is_array($actual)) {
            return array_key_exists($key, $actual) ? [$actual[$key], true] : [null, false];
        }
        if (is_object($actual) && property_exists($actual, $key)) {
            return [$actual->$key, true];
        }
        return [null, false];
    }

    /**
     * Assert that `actual` contains `expect`, recursively. Cases assert only
     * the fields they are about, so a full equality check would force every
     * case to restate the whole record.
     */
    private function subset($actual, $expect, string $path): void
    {
        if (is_array($expect) && (0 === count($expect) || !array_is_list($expect))) {
            foreach ($expect as $k => $want) {
                [$got, $found] = self::member($actual, (string)$k);
                $this->assertTrue($found, "$path.$k: no such member");
                $this->subset($got, $want, "$path.$k");
            }
            return;
        }

        if (is_int($expect) || is_float($expect)) {
            $this->assertTrue(is_int($actual) || is_float($actual),
                "$path: expected a number, got " . var_export($actual, true));
            // Money is float arithmetic; compare with a tolerance far below
            // any amount a case states.
            $this->assertLessThan(1e-9, abs((float)$actual - (float)$expect), $path);
            return;
        }

        $this->assertSame($expect, $actual, $path);
    }

    private static function record($client, string $name)
    {
        $prop = '_' . $name;
        return $client->$prop ?? null;
    }

    public function testCorpusCarriesAFeatureSection(): void
    {
        // A corpus with no `feature` section is a SKIP, not a failure. Each
        // project carries its OWN materialised copy of .sdk/test/test.json, so a
        // project scaffolded before the section existed legitimately has no cases
        // to run - and a hard assertion here turned that into a red suite in every
        // SDK on the fleet, for a corpus the project had simply not re-pulled yet.
        // The strict check belongs where the corpus is CONTROLLED: sdkgen's own
        // end-to-end lane supplies one and requires the cases to actually run.
        if (null === (self::corpus()['feature'] ?? null)) {
            $this->markTestSkipped(
                "this project's test.json has no `feature` section - recompile "
                . 'the corpus (create-sdkgen .sdk/test/feature/) to run these cases');
        }
        $this->assertNotNull(self::corpus()['feature']);
    }

    // At least one operation, or every case would skip and this suite would
    // report green having run nothing.
    public function testSdkHasAnOperationTheCorpusCanDrive(): void
    {
        $this->assertNotEmpty(self::usableOps(2),
            'no declared operation completed against a plain 200 - the corpus '
            . 'cannot exercise a feature without one');
    }

    public function testFeatureCorpus(): void
    {
        // Skip rather than run vacuously: with no section this asserts
        // nothing, which PHPUnit reports as RISKY - a third state that reads
        // like neither a pass nor a skip.
        if (null === (self::corpus()['feature'] ?? null)) {
            $this->markTestSkipped(
                "this project's test.json has no `feature` section - recompile "
                . 'the corpus (create-sdkgen .sdk/test/feature/) to run these cases');
        }

        $names = array_keys(self::corpus()['feature'] ?? []);
        sort($names);
        foreach ($names as $name) {
            $section = self::corpus()['feature'][$name] ?? null;
            if (null === $section) {
                continue;
            }

            $cases = $section['basic']['set'] ?? [];
            $this->assertNotEmpty($cases,
                "corpus section feature.$name ran ZERO cases - a renamed "
                . 'section or an emptied fixture must fail loudly');

            // Probed by ACTIVATING it: the feature defaults to inactive, so an
            // idle client never builds it and its absence says nothing.
            $probe = self::buildClient(['feature' => [['name' => $name, 'active' => true]]]);
            if (null === self::record($probe, $name)) {
                continue;
            }

            $ops = self::usableOps(2);
            $byKey = [];
            foreach ($ops as $o) {
                $byKey[$o['key']] = $o;
            }

            $ran = 0;
            foreach ($cases as $raw) {
                $need = self::tokensUsed($raw);
                if ($need > count($ops)) {
                    continue;
                }

                $tokens = [];
                for ($i = 0; $i < $need; $i++) {
                    $tokens['#OP' . ($i + 1)] = $ops[$i]['key'];
                }
                $kase = self::resolve($raw, $tokens);

                $client = self::buildClient($kase);
                $label = $kase['name'] ?? '';

                foreach (($kase['op'] ?? []) as $step) {
                    $op = $byKey[$step['op']] ?? null;
                    $this->assertNotNull($op, "$label: no operation {$step['op']}");
                    $ctrl = $step['ctrl'] ?? [];
                    $wanterr = $step['err'] ?? null;

                    try {
                        self::invoke($client, $op, $ctrl);
                        $this->assertNull($wanterr,
                            "$label: {$step['op']} was expected to fail, and did not");
                    } catch (\PHPUnit\Framework\AssertionFailedError $e) {
                        throw $e;
                    } catch (\Throwable $err) {
                        $this->assertNotNull($wanterr,
                            "$label: {$step['op']} failed unexpectedly: " . $err->getMessage());
                        if (is_string($wanterr)) {
                            // The CODE, not the message: make_error prefixes
                            // and humanises the text, so matching it would
                            // pass on any error that mentioned the word.
                            //
                            // `sdk_code`, not `code`: Exception::$code is a
                            // protected int on every PHP throwable, so the
                            // SDK carries its own string code beside it.
                            $code = property_exists($err, 'sdk_code') ? $err->sdk_code : null;
                            $this->assertSame($wanterr, $code,
                                "$label: wrong error code (" . $err->getMessage() . ')');
                        }
                    }
                }

                $this->subset(self::record($client, $name), $kase['out'] ?? [],
                    "$label: _$name");
                $ran++;
            }

            $this->assertGreaterThan(0, $ran, "every feature.$name case was skipped");
            // Say how many ran. A partial run is legitimate (an SDK with one
            // operation skips the cases needing two) but it should be visible
            // rather than inferred from a green tick.
            fwrite(STDERR, sprintf(
                "feature.%s: ran %d of %d case(s) against %d operation(s)\n",
                $name, $ran, count($cases), count($ops)));
        }
    }
}
