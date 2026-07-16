<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK base feature

class ZefoyTiktokBotBaseFeature
{
    public string $version;
    public string $name;
    public bool $active;

    // Positions this feature when added via the client `extend` option:
    // "__before__" / "__after__" / "__replace__" name an already-added
    // feature (mirrors the ts feature `_options`). Declared so setting it
    // on an extension instance avoids the dynamic-property deprecation.
    public ?array $_options = null;

    public function __construct()
    {
        $this->version = '0.0.1';
        $this->name = 'base';
        $this->active = true;
    }

    public function get_version(): string { return $this->version; }
    public function get_name(): string { return $this->name; }
    public function get_active(): bool { return $this->active; }

    public function init(ZefoyTiktokBotContext $ctx, array $options): void {}
    public function PostConstruct(ZefoyTiktokBotContext $ctx): void {}
    public function PostConstructEntity(ZefoyTiktokBotContext $ctx): void {}
    public function SetData(ZefoyTiktokBotContext $ctx): void {}
    public function GetData(ZefoyTiktokBotContext $ctx): void {}
    public function GetMatch(ZefoyTiktokBotContext $ctx): void {}
    public function SetMatch(ZefoyTiktokBotContext $ctx): void {}
    public function PrePoint(ZefoyTiktokBotContext $ctx): void {}
    public function PreSpec(ZefoyTiktokBotContext $ctx): void {}
    public function PreRequest(ZefoyTiktokBotContext $ctx): void {}
    public function PreResponse(ZefoyTiktokBotContext $ctx): void {}
    public function PreResult(ZefoyTiktokBotContext $ctx): void {}
    public function PreDone(ZefoyTiktokBotContext $ctx): void {}
    public function PreUnexpected(ZefoyTiktokBotContext $ctx): void {}
}
