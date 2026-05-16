<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK helpers

class ZefoyTiktokBotHelpers
{
    public static function to_map(mixed $v): ?array
    {
        return is_array($v) ? $v : null;
    }

    public static function to_int(mixed $v): int
    {
        return is_numeric($v) ? (int)$v : -1;
    }

    public static function get_ctx_prop(?array $m, string $key): mixed
    {
        if ($m === null) {
            return null;
        }
        return $m[$key] ?? null;
    }
}
