<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK test runner

class ZefoyTiktokBotTestRunner
{
    private static array $env = [];

    public static function load_env_local(): void
    {
        $env_file = __DIR__ . '/../../.env.local';
        if (!file_exists($env_file)) {
            return;
        }

        $lines = file($env_file, FILE_IGNORE_NEW_LINES);
        if ($lines === false) {
            return;
        }

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }
            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }
            self::$env[trim($parts[0])] = trim($parts[1]);
        }
    }

    public static function getenv(string $key): ?string
    {
        if (isset(self::$env[$key])) {
            return self::$env[$key];
        }
        $val = \getenv($key);
        return $val !== false ? $val : null;
    }

    public static function env_override(array $m): array
    {
        $live = self::getenv('PROJECTENV_TEST_LIVE');
        $override = self::getenv('PROJECTENV_TEST_OVERRIDE');

        if ($live === 'TRUE' || $override === 'TRUE') {
            foreach (array_keys($m) as $key) {
                $envval = self::getenv($key);
                if ($envval !== null && $envval !== '') {
                    $envval = trim($envval);
                    if (str_starts_with($envval, '{')) {
                        $parsed = json_decode($envval, true);
                        if (json_last_error() === JSON_ERROR_NONE) {
                            $m[$key] = $parsed;
                            continue;
                        }
                    }
                    $m[$key] = $envval;
                }
            }
        }

        $explain = self::getenv('PROJECTENV_TEST_EXPLAIN');
        if ($explain !== null && $explain !== '') {
            $m['PROJECTENV_TEST_EXPLAIN'] = $explain;
        }

        return $m;
    }

    public static function entity_list_to_data(array $list): array
    {
        $out = [];
        foreach ($list as $item) {
            if (is_array($item)) {
                $out[] = $item;
            } elseif (is_object($item) && method_exists($item, 'data_get')) {
                $d = $item->data_get();
                if (is_array($d)) {
                    $out[] = $d;
                }
            }
        }
        return $out;
    }

    private static $test_control = null;

    /**
     * Load sdk-test-control.json from this test dir; cache. Returns an
     * empty-skip default if the file is missing or invalid.
     */
    public static function load_test_control(): array
    {
        if (self::$test_control !== null) {
            return self::$test_control;
        }
        $ctrl_path = __DIR__ . '/sdk-test-control.json';
        $default = [
            'version' => 1,
            'test' => ['skip' => [
                'live' => ['direct' => [], 'entityOp' => []],
                'unit' => ['direct' => [], 'entityOp' => []],
            ]],
        ];
        if (!file_exists($ctrl_path)) {
            self::$test_control = $default;
            return self::$test_control;
        }
        $content = file_get_contents($ctrl_path);
        $parsed = json_decode($content, true);
        self::$test_control = is_array($parsed) ? $parsed : $default;
        return self::$test_control;
    }

    /**
     * Check sdk-test-control.json for a skip entry. Returns [skip, reason].
     */
    public static function is_control_skipped(string $kind, string $name, string $mode): array
    {
        $ctrl = self::load_test_control();
        $skip = $ctrl['test']['skip'][$mode] ?? [];
        $items = $skip[$kind] ?? [];
        foreach ($items as $item) {
            if ($kind === 'direct' && ($item['test'] ?? null) === $name) {
                return [true, $item['reason'] ?? null];
            }
            if ($kind === 'entityOp') {
                $key = ($item['entity'] ?? '') . '.' . ($item['op'] ?? '');
                if ($key === $name) {
                    return [true, $item['reason'] ?? null];
                }
            }
        }
        return [false, null];
    }

    /** Per-test live pacing delay (ms); default 500. */
    public static function live_delay_ms(): int
    {
        $ctrl = self::load_test_control();
        $v = $ctrl['test']['live']['delayMs'] ?? null;
        if (is_int($v) && $v >= 0) {
            return $v;
        }
        return 500;
    }
}

// Aliases for test convenience.
class_alias('ZefoyTiktokBotTestRunner', 'Runner');
class_alias('ZefoyTiktokBotHelpers', 'Helpers');
class_alias('Voxgig\Struct\Struct', 'Vs');

// Filter array of maps by matching key-value criteria.
function sdk_select(array $list, array $criteria): array
{
    $out = [];
    foreach ($list as $item) {
        if (!is_array($item)) continue;
        $match = true;
        foreach ($criteria as $k => $v) {
            if (!isset($item[$k]) || $item[$k] !== $v) {
                $match = false;
                break;
            }
        }
        if ($match) $out[] = $item;
    }
    return $out;
}
