# ZefoyTiktokBot Ruby SDK Reference

Complete API reference for the ZefoyTiktokBot Ruby SDK.


## ZefoyTiktokBotSDK

### Constructor

```ruby
require_relative 'ZefoyTiktokBot_sdk'

client = ZefoyTiktokBotSDK.new(options)
```

Create a new SDK client instance.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `Hash` | SDK configuration options. |
| `options["apikey"]` | `String` | API key for authentication. |
| `options["base"]` | `String` | Base URL for API requests. |
| `options["prefix"]` | `String` | URL prefix appended after base. |
| `options["suffix"]` | `String` | URL suffix appended after path. |
| `options["headers"]` | `Hash` | Custom headers for all requests. |
| `options["feature"]` | `Hash` | Feature configuration. |
| `options["system"]` | `Hash` | System overrides (e.g. custom fetch). |


### Static Methods

#### `ZefoyTiktokBotSDK.test(testopts = nil, sdkopts = nil)`

Create a test client with mock features active. Both arguments may be `nil`.

```ruby
client = ZefoyTiktokBotSDK.test
```


### Instance Methods

#### `Engagement(data = nil)`

Create a new `Engagement` entity instance. Pass `nil` for no initial data.

#### `options_map -> Hash`

Return a deep copy of the current SDK options.

#### `get_utility -> Utility`

Return a copy of the SDK utility object.

#### `direct(fetchargs = {}) -> Hash`

Make a direct HTTP request to any API endpoint. Returns a result hash
(`{ "ok" => ..., "status" => ..., "data" => ..., "err" => ... }`); it
does not raise — inspect `result["ok"]`.

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fetchargs["path"]` | `String` | URL path with optional `{param}` placeholders. |
| `fetchargs["method"]` | `String` | HTTP method (default: `"GET"`). |
| `fetchargs["params"]` | `Hash` | Path parameter values for `{param}` substitution. |
| `fetchargs["query"]` | `Hash` | Query string parameters. |
| `fetchargs["headers"]` | `Hash` | Request headers (merged with defaults). |
| `fetchargs["body"]` | `any` | Request body (hashes are JSON-serialized). |
| `fetchargs["ctrl"]` | `Hash` | Control options (e.g. `{ "explain" => true }`). |

**Returns:** `Hash`

#### `prepare(fetchargs = {}) -> Hash`

Prepare a fetch definition without sending the request. Accepts the
same parameters as `direct()`. Raises on error.

**Returns:** `Hash` (the fetch definition; raises on error)


---

## EngagementEntity

```ruby
engagement = client.Engagement
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `amount` | `Integer` | No | The amount of engagement to acquire (if applicable) |
| `estimatedTime` | `Integer` | No | Estimated time to complete in seconds |
| `message` | `String` | No | Response message |
| `status` | `String` | No | Current status of the boost request |
| `success` | `Boolean` | No | Indicates if the request was successful |
| `type` | `String` | No | The type of engagement boosted |
| `url` | `String` | Yes | The TikTok video or profile URL to boost |

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

#### `create(reqdata, ctrl = nil) -> result`

Create a new entity with the given data. Raises on error.

```ruby
result = client.Engagement.create({
  "url" => "example_url", # String
})
```

### Common Methods

#### `data_get -> Hash`

Get the entity data. Returns a copy of the current data.

#### `data_set(data)`

Set the entity data.

#### `match_get -> Hash`

Get the entity match criteria.

#### `match_set(match)`

Set the entity match criteria.

#### `make -> Entity`

Create a new `EngagementEntity` instance with the same client and
options.

#### `get_name -> String`

Return the entity name.


---

## Features

| Feature | Version | Description |
| --- | --- | --- |
| `test` | 0.0.1 | In-memory mock transport for testing without a live server |


Features are activated via the `feature` option:

```ruby
client = ZefoyTiktokBotSDK.new({
  "feature" => {
    "test" => { "active" => true },
  },
})
```

