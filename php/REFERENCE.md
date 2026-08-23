# ZefoyTiktokBot PHP SDK Reference

Complete API reference for the ZefoyTiktokBot PHP SDK.


## ZefoyTiktokBotSDK

### Constructor

```php
require_once __DIR__ . '/zefoytiktokbot_sdk.php';

$client = new ZefoyTiktokBotSDK($options);
```

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `$options` | `array` | SDK configuration options. |
| `$options["apikey"]` | `string` | API key for authentication. |
| `$options["base"]` | `string` | Base URL for API requests. |
| `$options["prefix"]` | `string` | URL prefix appended after base. |
| `$options["suffix"]` | `string` | URL suffix appended after path. |
| `$options["headers"]` | `array` | Custom headers for all requests. |
| `$options["feature"]` | `array` | Feature configuration. |
| `$options["system"]` | `array` | System overrides (e.g. custom fetch). |


### Static Methods

#### `ZefoyTiktokBotSDK::test($testopts = null, $sdkopts = null)`

Create a test client with mock features active. Both arguments may be `null`.

```php
$client = ZefoyTiktokBotSDK::test();
```


### Instance Methods

#### `Engagement($data = null)`

Create a new `EngagementEntity` instance. Pass `null` for no initial data.

#### `options_map(): array`

Return a deep copy of the current SDK options.

#### `get_utility(): ZefoyTiktokBotUtility`

Return a copy of the SDK utility object.

#### `direct(array $fetchargs = []): array`

Make a direct HTTP request to any API endpoint. This is the raw-HTTP escape
hatch: it does **not** throw. It returns a result array
`["ok" => bool, "status" => int, "headers" => array, "data" => mixed]`, or
`["ok" => false, "err" => \Exception]` on failure. Branch on `$result["ok"]`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `$fetchargs["path"]` | `string` | URL path with optional `{param}` placeholders. |
| `$fetchargs["method"]` | `string` | HTTP method (default: `"GET"`). |
| `$fetchargs["params"]` | `array` | Path parameter values for `{param}` substitution. |
| `$fetchargs["query"]` | `array` | Query string parameters. |
| `$fetchargs["headers"]` | `array` | Request headers (merged with defaults). |
| `$fetchargs["body"]` | `mixed` | Request body (arrays are JSON-serialized). |
| `$fetchargs["ctrl"]` | `array` | Control options. |

**Returns:** `array` — the result dict (see above); never throws.

#### `prepare(array $fetchargs = []): mixed`

Prepare a fetch definition without sending the request. Returns the
`$fetchdef` array. Throws on error.


---

## EngagementEntity

```php
$engagement = $client->Engagement();
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | `int` | No | The amount of engagement to acquire (if applicable) |
| `estimatedTime` | `int` | No | Estimated time to complete in seconds |
| `message` | `string` | No | Response message |
| `status` | `string` | No | Current status of the boost request |
| `success` | `bool` | No | Indicates if the request was successful |
| `type` | `string` | No | The type of engagement boosted |
| `url` | `string` | Yes | The TikTok video or profile URL to boost |

### Field Usage by Operation

| Field | create |
| --- | --- |
| `amount` | - |
| `estimatedTime` | - |
| `message` | - |
| `status` | - |
| `success` | - |
| `type` | Yes |
| `url` | - |

### Operations

#### `create(array $reqdata, ?array $ctrl = null): mixed`

Create a new entity with the given data. Throws on error.

```php
$result = $client->Engagement()->create([
  "url" => null, // string
]);
```

### Common Methods

#### `data_get(): array`

Get the entity data. Returns a copy of the current data.

#### `data_set($data): void`

Set the entity data.

#### `match_get(): array`

Get the entity match criteria.

#### `match_set($match): void`

Set the entity match criteria.

#### `make(): EngagementEntity`

Create a new `EngagementEntity` instance with the same client and
options.

#### `get_name(): string`

Return the entity name.


---

## Features

| Feature | Version | Description |
| --- | --- | --- |
| `test` | 0.0.1 | In-memory mock transport for testing without a live server |


Features are activated via the `feature` option:

```php
$client = new ZefoyTiktokBotSDK([
  "feature" => [
    "test" => ["active" => true],
  ],
]);
```

