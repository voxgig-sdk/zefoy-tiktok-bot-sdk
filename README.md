# ZefoyTiktokBot SDK

Unofficial wrapper around Zefoy's free TikTok engagement automation site

> TypeScript, Python, PHP, Golang, Ruby, Lua SDKs, a CLI, an interactive REPL, and an MCP server for AI agents — all generated from one OpenAPI spec by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen).

## About Zefoy TikTok Bot

[Zefoy](https://zefoy.com) is a free, web-based tool that offers TikTok engagement actions (such as views, hearts, followers and shares) gated by per-action cooldown timers and CAPTCHA checks. This SDK is an unofficial wrapper that targets the public `https://zefoy.com` site rather than a documented HTTP API.

Because Zefoy itself does not publish an API specification, the surface exposed here is a thin scripted client over the same forms a browser would submit. Expect to handle:

- CAPTCHA prompts before any engagement action can run
- Cooldown windows between successive requests for the same action
- HTML/markup changes on the upstream site that may require the SDK to be updated

Zefoy's own homepage stresses that it does not sell services, run official apps, or operate paid tiers, and that the only legitimate entry point is `https://zefoy.com/`. Anything else claiming to be Zefoy is not. Use this SDK accordingly, and review TikTok's Terms of Service before automating against accounts you care about.

## Try it

**TypeScript**
```bash
npm install zefoy-tiktok-bot
```

**Python**
```bash
pip install zefoy-tiktok-bot-sdk
```

**PHP**
```bash
composer require voxgig/zefoy-tiktok-bot-sdk
```

**Golang**
```bash
go get github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go
```

**Ruby**
```bash
gem install zefoy-tiktok-bot-sdk
```

**Lua**
```bash
luarocks install zefoy-tiktok-bot-sdk
```

## 30-second quickstart

### TypeScript

```ts
import { ZefoyTiktokBotSDK } from 'zefoy-tiktok-bot'

const client = new ZefoyTiktokBotSDK({})

```

See the [TypeScript README](ts/README.md) for the
full guide, or scroll down for the same example in other languages.

## What's in the box

| Surface | Use it for | Path |
| --- | --- | --- |
| **SDK** (TypeScript, Python, PHP, Golang, Ruby, Lua) | App integration | `ts/` `py/` `php/` `go/` `rb/` `lua/` |
| **CLI** | Scripts, CI, ops, one-off API calls | `go-cli/` |
| **MCP server** | AI agents (Claude, Cursor, Cline) | `go-mcp/` |

## Use it from an AI agent (MCP)

The generated MCP server exposes every operation in this SDK as an
[MCP](https://modelcontextprotocol.io) tool that Claude, Cursor or Cline
can call directly. Build and register it:

```bash
cd go-mcp && go build -o zefoy-tiktok-bot-mcp .
```

Then add it to your agent's MCP config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "zefoy-tiktok-bot": {
      "command": "/abs/path/to/zefoy-tiktok-bot-mcp"
    }
  }
}
```

## Entities

The API exposes one entity:

| Entity | Description | API path |
| --- | --- | --- |
| **Engagement** | Represents TikTok engagement actions (e.g. views, hearts, followers, shares) requested through the Zefoy site, each subject to its own cooldown and CAPTCHA gate. | `/api/boost` |

Each entity supports the following operations where available: **load**,
**list**, **create**, **update**, and **remove**.

## Quickstart in other languages

### Python

```python
from zefoytiktokbot_sdk import ZefoyTiktokBotSDK

client = ZefoyTiktokBotSDK({})

```

### PHP

```php
<?php
require_once 'zefoytiktokbot_sdk.php';

$client = new ZefoyTiktokBotSDK([]);

```

### Golang

```go
import sdk "github.com/voxgig-sdk/zefoy-tiktok-bot-sdk/go"

client := sdk.NewZefoyTiktokBotSDK(map[string]any{})

```

### Ruby

```ruby
require_relative "ZefoyTiktokBot_sdk"

client = ZefoyTiktokBotSDK.new({})

```

### Lua

```lua
local sdk = require("zefoy-tiktok-bot_sdk")

local client = sdk.new({})

```

## Unit testing in offline mode

Every SDK ships a test mode that swaps the HTTP transport for an
in-memory mock, so unit tests run offline.

### TypeScript

```ts
const client = ZefoyTiktokBotSDK.test()
const result = await client.Engagement().load({ id: 'test01' })
// result.ok === true, result.data contains mock data
```

### Python

```python
client = ZefoyTiktokBotSDK.test(None, None)
result, err = client.Engagement(None).load(
    {"id": "test01"}, None
)
```

### PHP

```php
$client = ZefoyTiktokBotSDK::test(null, null);
[$result, $err] = $client->Engagement(null)->load(
    ["id" => "test01"], null
);
```

### Golang

```go
client := sdk.TestSDK(nil, nil)
result, err := client.Engagement(nil).Load(
    map[string]any{"id": "test01"}, nil,
)
```

### Ruby

```ruby
client = ZefoyTiktokBotSDK.test(nil, nil)
result, err = client.Engagement(nil).load(
  { "id" => "test01" }, nil
)
```

### Lua

```lua
local client = sdk.test(nil, nil)
local result, err = client:Engagement(nil):load(
  { id = "test01" }, nil
)
```

## How it works

Every SDK call runs the same five-stage pipeline:

1. **Point** — resolve the API endpoint from the operation definition.
2. **Spec** — build the HTTP specification (URL, method, headers, body).
3. **Request** — send the HTTP request.
4. **Response** — receive and parse the response.
5. **Result** — extract the result data for the caller.

A feature hook fires at each stage (e.g. `PrePoint`, `PreSpec`,
`PreRequest`), so features can inspect or modify the pipeline without
forking the SDK.

### Features

| Feature | Purpose |
| --- | --- |
| **TestFeature** | In-memory mock transport for testing without a live server |

Pass custom features via the `extend` option at construction time.

### Direct and Prepare

For endpoints the entity model doesn't cover, use the low-level methods:

- **`direct(fetchargs)`** — build and send an HTTP request in one step.
- **`prepare(fetchargs)`** — build the request without sending it.

Both accept a map with `path`, `method`, `params`, `query`,
`headers`, and `body`. See the [How-to guides](#how-to-guides) below.

## How-to guides

### Make a direct API call

When the entity interface does not cover an endpoint, use `direct`:

**TypeScript:**
```ts
const result = await client.direct({
  path: '/api/resource/{id}',
  method: 'GET',
  params: { id: 'example' },
})
console.log(result.data)
```

**Python:**
```python
result, err = client.direct({
    "path": "/api/resource/{id}",
    "method": "GET",
    "params": {"id": "example"},
})
```

**PHP:**
```php
[$result, $err] = $client->direct([
    "path" => "/api/resource/{id}",
    "method" => "GET",
    "params" => ["id" => "example"],
]);
```

**Go:**
```go
result, err := client.Direct(map[string]any{
    "path":   "/api/resource/{id}",
    "method": "GET",
    "params": map[string]any{"id": "example"},
})
```

**Ruby:**
```ruby
result, err = client.direct({
  "path" => "/api/resource/{id}",
  "method" => "GET",
  "params" => { "id" => "example" },
})
```

**Lua:**
```lua
local result, err = client:direct({
  path = "/api/resource/{id}",
  method = "GET",
  params = { id = "example" },
})
```

## Per-language documentation

- [TypeScript](ts/README.md)
- [Python](py/README.md)
- [PHP](php/README.md)
- [Golang](go/README.md)
- [Ruby](rb/README.md)
- [Lua](lua/README.md)

## Using the Zefoy TikTok Bot

- Upstream: [https://zefoy.com](https://zefoy.com)

- SDK code is distributed under the MIT licence.
- Zefoy is a third-party website; this project is not affiliated with, endorsed by, or sponsored by Zefoy or TikTok.
- Zefoy publishes no public API contract, so endpoint behaviour can change or break at any time.
- Automating engagement on TikTok may violate TikTok's Terms of Service; use at your own risk.

---

Generated from the Zefoy TikTok Bot OpenAPI spec by [@voxgig/sdkgen](https://github.com/voxgig/sdkgen).
