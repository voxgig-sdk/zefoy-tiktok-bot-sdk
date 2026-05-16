<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK feature factory

require_once __DIR__ . '/feature/BaseFeature.php';
require_once __DIR__ . '/feature/TestFeature.php';


class ZefoyTiktokBotFeatures
{
    public static function make_feature(string $name)
    {
        switch ($name) {
            case "base":
                return new ZefoyTiktokBotBaseFeature();
            case "test":
                return new ZefoyTiktokBotTestFeature();
            default:
                return new ZefoyTiktokBotBaseFeature();
        }
    }
}
