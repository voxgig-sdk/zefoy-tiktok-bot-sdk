<?php
declare(strict_types=1);

// ZefoyTiktokBot SDK configuration

class ZefoyTiktokBotConfig
{
    /** @var array<string,mixed>|null */
    private static ?array $shared_config = null;

    /**
     * Return the process-wide config, built once on first use. The SDK reads
     * the config on every request and never writes to it, so one instance is
     * shared by every client rather than rebuilt per client.
     *
     * PHP arrays are copy-on-write, so callers that do mutate the result get
     * their own copy and cannot disturb the shared one.
     */
    public static function shared_config(): array
    {
        if (self::$shared_config === null) {
            self::$shared_config = self::make_config();
        }
        return self::$shared_config;
    }

    /**
     * Build a fresh, fully materialised config array. Every call rebuilds the
     * whole structure, so prefer shared_config unless you need a private copy.
     */
    public static function make_config(): array
    {
        return [
            "main" => [
                "name" => "ZefoyTiktokBot",
                "slug" => "zefoy-tiktok-bot",
                "version" => "0.0.1",
                "target" => "php",
            ],
            "feature" => [
                "test" => [
          'options' => [
            'active' => false,
          ],
          'transport' => 'base',
        ],
            ],
            "options" => [
                "base" => "https://zefoy.com",
                "auth" => [
                    "prefix" => "",
                ],
                "headers" => [
          'content-type' => 'application/json',
        ],
                "entity" => [
                    "engagement" => [],
                ],
            ],
            "entity" => [
        'engagement' => [
          'fields' => [
            [
              'name' => 'amount',
              'short' => 'The amount of engagement to acquire (if applicable)',
              'type' => '`$INTEGER`',
            ],
            [
              'name' => 'estimatedTime',
              'short' => 'Estimated time to complete in seconds',
              'type' => '`$INTEGER`',
            ],
            [
              'name' => 'message',
              'short' => 'Response message',
              'type' => '`$STRING`',
            ],
            [
              'name' => 'status',
              'short' => 'Current status of the boost request',
              'type' => '`$STRING`',
            ],
            [
              'name' => 'success',
              'short' => 'Indicates if the request was successful',
              'type' => '`$BOOLEAN`',
            ],
            [
              'name' => 'type',
              'op' => [
                'create' => [
                  'req' => true,
                  'type' => '`$STRING`',
                ],
              ],
              'short' => 'The type of engagement boosted',
              'type' => '`$STRING`',
            ],
            [
              'name' => 'url',
              'req' => true,
              'short' => 'The TikTok video or profile URL to boost',
              'type' => '`$STRING`',
            ],
          ],
          'name' => 'engagement',
          'op' => [
            'create' => [
              'input' => 'data',
              'name' => 'create',
              'points' => [
                [
                  'args' => [],
                  'kind' => 'http',
                  'method' => 'POST',
                  'orig' => '/api/boost',
                  'parts' => [
                    'api',
                    'boost',
                  ],
                  'select' => [],
                  'transform' => [
                    'req' => '`reqdata`',
                    'res' => '`body`',
                  ],
                ],
              ],
            ],
          ],
          'relations' => [
            'ancestors' => [],
          ],
        ],
      ],
        ];
    }


    public static function make_feature(string $name)
    {
        require_once __DIR__ . '/features.php';
        return ZefoyTiktokBotFeatures::make_feature($name);
    }
}
