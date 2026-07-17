
import * as Path from 'node:path'

import {
  cmp, each,
  File, Content, Fragment, Slot,
} from '@voxgig/sdkgen'

import type {
  ModelEntity,
} from '@voxgig/apidef'

import {
  KIT,
  getModelPath,
} from '@voxgig/apidef'


const MCP_GO_SDK_VERSION = 'v1.6.0'

// go.sum entries for MCP_GO_SDK_VERSION and its transitive deps. The sibling
// SDK dep needs no entry (path replace). Deterministic because the version
// is pinned above — regenerate with `go mod tidy` and update BOTH constants
// together when bumping MCP_GO_SDK_VERSION.
const MCP_GO_SDK_GOSUM = `github.com/golang-jwt/jwt/v5 v5.3.1 h1:kYf81DTWFe7t+1VvL7eS+jKFVWaUnK9cB1qbwn63YCY=
github.com/golang-jwt/jwt/v5 v5.3.1/go.mod h1:fxCRLWMO43lRc8nhHWY6LGqRcf+1gQWArsqaEUEa5bE=
github.com/google/go-cmp v0.7.0 h1:wk8382ETsv4JYUZwIsn6YpYiWiBsYLSJiTsyBybVuN8=
github.com/google/go-cmp v0.7.0/go.mod h1:pXiqmnSA92OHEEa9HXL2W4E7lf9JzCmGVUdgjX3N/iU=
github.com/google/jsonschema-go v0.4.3 h1:/DBOLZTfDow7pe2GmaJNhltueGTtDKICi8V8p+DQPd0=
github.com/google/jsonschema-go v0.4.3/go.mod h1:r5quNTdLOYEz95Ru18zA0ydNbBuYoo9tgaYcxEYhJVE=
github.com/modelcontextprotocol/go-sdk v1.6.0 h1:PPLS3kn7WtOEnR+Af4X5H96SG0qSab8R/ZQT/HkhPkY=
github.com/modelcontextprotocol/go-sdk v1.6.0/go.mod h1:kzm3kzFL1/+AziGOE0nUs3gvPoNxMCvkxokMkuFapXQ=
github.com/segmentio/asm v1.1.3 h1:WM03sfUOENvvKexOLp+pCqgb/WDjsi7EK8gIsICtzhc=
github.com/segmentio/asm v1.1.3/go.mod h1:Ld3L4ZXGNcSLRg4JBsZ3//1+f/TjYl0Mzen/DQy1EJg=
github.com/segmentio/encoding v0.5.4 h1:OW1VRern8Nw6ITAtwSZ7Idrl3MXCFwXHPgqESYfvNt0=
github.com/segmentio/encoding v0.5.4/go.mod h1:HS1ZKa3kSN32ZHVZ7ZLPLXWvOVIiZtyJnO1gPH1sKt0=
github.com/yosida95/uritemplate/v3 v3.0.2 h1:Ed3Oyj9yrmi9087+NczuL5BwkIc4wvTb5zIM+UJPGz4=
github.com/yosida95/uritemplate/v3 v3.0.2/go.mod h1:ILOh0sOhIJR3+L/8afwt/kE++YT040gmv5BQTMR2HP4=
golang.org/x/oauth2 v0.35.0 h1:Mv2mzuHuZuY2+bkyWXIHMfhNdJAdwW3FuWeCPYN5GVQ=
golang.org/x/oauth2 v0.35.0/go.mod h1:lzm5WQJQwKZ3nwavOZ3IS5Aulzxi68dUSgRHujetwEA=
golang.org/x/sys v0.41.0 h1:Ivj+2Cp/ylzLiEU89QhWblYnOE9zerudt9Ftecq2C6k=
golang.org/x/sys v0.41.0/go.mod h1:OgkHotnGiDImocRcuBABYBEXf8A9a87e/uXjp9XT3ks=
golang.org/x/tools v0.42.0 h1:uNgphsn75Tdz5Ji2q36v/nsFSfR/9BRFvqhGBaJGd5k=
golang.org/x/tools v0.42.0/go.mod h1:Ma6lCIwGZvHK6XtgbswSoWroEkhugApmsXyrUmBhfr0=
`


const Main = cmp(function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const org = model.origin || 'voxgig-sdk'
  const sdkModule = `github.com/${org}/${model.name}-sdk/go`
  const mcpModule = `github.com/${org}/${model.name}-sdk/go-mcp`

  const entityMap: any = getModelPath(model, `main.${KIT}.entity`)
  const entityNames = Object.keys(entityMap).map(n => n.toLowerCase())
  const entityHelp = entityNames.length > 0 ? entityNames.join(' | ') : '(none)'

  // Slug-based tool name prefix. Goes into `<slug>_list` / `<slug>_load`
  // tool names so an MCP host with multiple installed SDK servers
  // sees unambiguous tool ids.
  const slugLower = model.name.toLowerCase()

  const FRAGMENT = Path.normalize(__dirname + '/../../../src/cmp/go-mcp/fragment')

  // .gitignore — build output (dist/) and any stray top-level binaries.
  File({ name: '.gitignore' }, () => Content(`/dist/
/${model.name}-mcp
/go-mcp
`))

  // ==========================================================================
  // README.md — Diátaxis-structured, examples-first usage guide.
  //
  // The server ALWAYS registers exactly two tools (<slug>_list / <slug>_load;
  // see tools.fragment.go), so tools are not gated. Concrete tool-call and
  // entity examples are MODEL-DRIVEN off the real slug + entity names.
  // ==========================================================================
  const bin = `${model.name}-mcp`
  const toolList = `${slugLower}_list`
  const toolLoad = `${slugLower}_load`
  const entityCount = entityNames.length
  const entityNoun = entityCount === 1 ? 'entity' : 'entities'
  const firstEntity = entityNames[0] || 'entity'

  // Example entities chosen per-op so a doc example never shows an entity that
  // doesn't support the op being demonstrated (both tools are always
  // registered, but a given entity only responds to the ops it exposes).
  const activeEntityObjs: any[] =
    Object.values(entityMap).filter((e: any) => e && e.active !== false)
  const entWithOp = (op: string) => {
    const e = activeEntityObjs.find(
      (x: any) => x.op && x.op[op] && x.op[op].active !== false)
    return e ? String(e.name).toLowerCase() : firstEntity
  }
  const listEntity = entWithOp('list')
  const loadEntity = entWithOp('load')

  const projUpper = String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const apiKeyEnv = projUpper + '_APIKEY'
  const baseEnv = projUpper + '_BASE'

  File({ name: 'README.md' }, () => Content(`# ${model.name}-mcp

[MCP](https://modelcontextprotocol.io) server exposing the ${model.Name} SDK as
two agent tools — \`${toolList}\` and \`${toolLoad}\` — built on the
[official Go MCP SDK](https://github.com/modelcontextprotocol/go-sdk) and the
sibling Go SDK at \`../go\`. Runs over **stdio** (default, for spawnable installs)
or **streamable HTTP** (one shared server for several agents).

## Examples

\`\`\`sh
# 1. Build a native binary (-> dist/<os>-<arch>/${bin})
make build

# 2. Provide credentials via the environment
export ${apiKeyEnv}=sk_live_xxx

# 3a. Install into Claude Code over stdio (most common)
claude mcp add --scope user ${slugLower} \\
  -- /absolute/path/to/${bin} -transport stdio

# 3b. …or run a shared HTTP server instead
./${bin} -transport http -addr :8080
\`\`\`

Tool-call arguments (what an agent sends):

\`\`\`jsonc
// ${toolList}: first page of records
{ "entity": "${listEntity}" }
{ "entity": "${listEntity}", "query": { } }

// ${toolLoad}: one record by id
{ "entity": "${loadEntity}", "query": { "id": 1 } }
\`\`\`

> The rest of this guide follows the [Diátaxis](https://diataxis.fr) framework:
> a hands-on **Tutorial**, task-focused **How-to guides**, a factual
> **Reference**, and background **Explanation**.

## Tutorial: install and call a tool

1. **Build** the server from this \`go-mcp/\` directory:

   \`\`\`sh
   make build          # -> dist/<os>-<arch>/${bin}
   \`\`\`

2. **Set your API key:**

   \`\`\`sh
   export ${apiKeyEnv}=sk_live_xxx
   \`\`\`

3. **Install it into Claude Code** (stdio transport):

   \`\`\`sh
   claude mcp add --scope user ${slugLower} \\
     -- "$PWD"/dist/*/${bin} -transport stdio
   \`\`\`

4. **Restart Claude Code.** The \`${toolList}\` and \`${toolLoad}\` tools now appear
   in new sessions. Ask the agent to *"list ${listEntity} using ${slugLower}"*
   and it calls \`${toolList}\` with \`{"entity":"${listEntity}"}\`.

## How-to guides

### Authenticate and choose an environment

Configuration is read from the environment — nothing is written to disk:

\`\`\`sh
export ${apiKeyEnv}=sk_live_xxx            # API key
export ${baseEnv}=https://api.example.com  # optional: override the API base URL
\`\`\`

Set these in the shell that launches the server (or in the \`claude mcp add\`
environment) so every tool call is authenticated.

### Run as a shared HTTP server

\`\`\`sh
./${bin} -transport http -addr :8080
\`\`\`

Streamable HTTP lets several agents share one running process; stdio (the
default) spawns a fresh process per client.

### Call the \`${toolList}\` tool

Args: \`entity\` (required), \`query\` (optional filter map). Returns the first
page of records as JSON:

\`\`\`jsonc
{ "entity": "${listEntity}" }
\`\`\`

### Call the \`${toolLoad}\` tool

Args: \`entity\` (required), \`query\` = \`{"id":N}\` (required). Returns the single
record as JSON:

\`\`\`jsonc
{ "entity": "${loadEntity}", "query": { "id": 1 } }
\`\`\`

### Cross-compile release binaries

\`\`\`sh
make build       # native binary for this machine
make build-all   # linux/darwin/windows x amd64/arm64, under dist/<os>-<arch>/
\`\`\`

## Reference

### Tools

| Tool | Args | Returns |
|------|------|---------|
| \`${toolList}\` | \`entity\` (required), \`query\` (optional map) | First page of records as JSON |
| \`${toolLoad}\` | \`entity\` (required), \`query\` = \`{id:N}\` | Single record as JSON |

On error, a tool returns an MCP error result (\`isError: true\`) whose text is the
failure message (e.g. unknown entity, or an API error).

### \`Args\` schema

Both tools take the same argument object:

| Field | Type | Notes |
|-------|------|-------|
| \`entity\` | string | One of the ${entityCount} supported entities (see below). |
| \`query\` | object | Optional match map. \`{"id":N}\` for load; omit or \`{}\` for list. |

JSON schemas are emitted by the SDK from the \`Args\` struct's \`json\` /
\`jsonschema\` tags — no schema is hand-written.

### Transports & flags

| Flag | Default | Purpose |
|------|---------|---------|
| \`-transport\` | \`stdio\` | \`stdio\` (spawnable) or \`http\` (streamable HTTP). |
| \`-addr\` | \`:8080\` | Listen address for the \`http\` transport. |

### Environment variables

| Variable | Purpose |
|----------|---------|
| \`${apiKeyEnv}\` | API key sent with every request. |
| \`${baseEnv}\` | Optional override of the API base URL. |

### Entities

The ${entityCount} ${entityNoun} valid as the \`entity\` argument:

${entityHelp}

### Smoke test via HTTP (raw JSON-RPC)

\`\`\`sh
./${bin} -transport http -addr :18080 &

# initialize, grab the session id
curl -sN -X POST http://localhost:18080 \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -D headers \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}'

SESSION=$(awk '/Mcp-Session-Id/ {print $2}' headers | tr -d '\\r')

curl -sN -X POST http://localhost:18080 \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H "Mcp-Session-Id: $SESSION" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"${toolLoad}","arguments":{"entity":"${loadEntity}","query":{"id":1}}}}'
\`\`\`

## Explanation

### How tools map to the SDK

\`main.go\` builds the SDK client (configured from the environment) and registers
two tools. Each dispatches on the \`entity\` argument to the matching entity in
the sibling Go SDK at \`../go\`, calls \`List\` or \`Load\`, unwraps the \`Entity\`
wrappers to plain data, and returns it as pretty-printed JSON.

### Why two transports

**stdio** is the standard for agent hosts that spawn a server per client
(Claude Code's \`claude mcp add\`). **streamable HTTP** keeps one process running
that many agents can share — handy for a long-lived deployment.

### Schema generation

The input schema is derived from the \`Args\` Go struct's \`json\` / \`jsonschema\`
tags at registration time, so the advertised tool schema can never drift from
the code that consumes it.

## Generated by

sdkgen \`go-mcp\` target. See the target source under \`.sdk/src/cmp/go-mcp/\` in
this repo, or upstream at
\`github.com/voxgig/sdkgen/project/.sdk/src/cmp/go-mcp/\`.
`))

  // go.mod — sibling SDK via relative replace; MCP Go SDK pulled from
  // the public proxy. The MCP Go SDK requires go >= 1.25.
  File({ name: 'go.mod' }, () => Content(`module ${mcpModule}

go 1.25.0

require ${sdkModule} v0.0.0
require github.com/modelcontextprotocol/go-sdk ${MCP_GO_SDK_VERSION}

require (
	github.com/google/jsonschema-go v0.4.3 // indirect
	github.com/segmentio/asm v1.1.3 // indirect
	github.com/segmentio/encoding v0.5.4 // indirect
	github.com/yosida95/uritemplate/v3 v3.0.2 // indirect
	golang.org/x/oauth2 v0.35.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
)

replace ${sdkModule} => ../go
`))

  // go.sum — required for `go build` to accept the MCP SDK dependency
  // (the path-replaced sibling SDK needs no entry). Pinned alongside
  // MCP_GO_SDK_VERSION above.
  File({ name: 'go.sum' }, () => Content(MCP_GO_SDK_GOSUM))

  // Makefile — `make build` for the current machine, `make build-all` to
  // cross-compile for the three desktop OSes (linux, darwin, windows) on
  // amd64 + arm64. Every binary is named ${model.name}-mcp (+ .exe on windows)
  // inside its own dist/<os>-<arch>/ folder — no loose top-level binary.
  File({ name: 'Makefile' }, () => Content(`# ${model.name}-mcp build. GENERATED by @voxgig/sdkgen go-mcp target.
BINARY := ${model.name}-mcp
DIST := dist
GOOS := $(shell go env GOOS)
GOARCH := $(shell go env GOARCH)
EXT := $(if $(filter windows,$(GOOS)),.exe,)

.PHONY: build build-all clean

# Native build for the current machine -> dist/<os>-<arch>/${model.name}-mcp.
build:
\tgo build -o $(DIST)/$(GOOS)-$(GOARCH)/$(BINARY)$(EXT) .

# Cross-compiled release binaries: three desktop OSes x amd64/arm64, each named
# ${model.name}-mcp (+ .exe on windows) inside its own dist/<os>-<arch>/ folder.
build-all: clean
\tGOOS=linux   GOARCH=amd64 go build -o $(DIST)/linux-amd64/$(BINARY) .
\tGOOS=linux   GOARCH=arm64 go build -o $(DIST)/linux-arm64/$(BINARY) .
\tGOOS=darwin  GOARCH=amd64 go build -o $(DIST)/darwin-amd64/$(BINARY) .
\tGOOS=darwin  GOARCH=arm64 go build -o $(DIST)/darwin-arm64/$(BINARY) .
\tGOOS=windows GOARCH=amd64 go build -o $(DIST)/windows-amd64/$(BINARY).exe .
\tGOOS=windows GOARCH=arm64 go build -o $(DIST)/windows-arm64/$(BINARY).exe .

clean:
\trm -rf $(DIST) $(BINARY) go-mcp
`))

  // main.go — produced from fragment/main.fragment.go with one Slot
  // for the MCP server's announced name.
  File({ name: 'main.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'main.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
          // Env vars the server reads: <PROJ>_APIKEY for the key and <PROJ>_BASE
          // to override the API base URL (both injectable by a secrets vault).
          APIKEYENVVAR: String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_APIKEY',
          BASEENVVAR: String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_BASE',
        },
      },
      () => {
        Slot({ name: 'serverName' }, () => Content(slugLower))
      },
    )
  })

  // tools.go — produced from fragment/tools.fragment.go with Slots
  // for: the entity help string in the input-schema description,
  // the two tool name prefixes (`<slug>_list` / `<slug>_load`), and
  // a per-entity `case` block in the entity dispatch switch.
  File({ name: 'tools.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'tools.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
        },
      },
      () => {
        Slot({ name: 'entityHelp' }, () => Content(entityHelp))
        Slot({ name: 'toolPrefixList' }, () => Content(`${slugLower}_list`))
        Slot({ name: 'toolPrefixLoad' }, () => Content(`${slugLower}_load`))
        Slot({ name: 'entityCases' }, () => {
          each(entityMap, (entity: ModelEntity) => {
            const lower = entity.name.toLowerCase()
            const pascal = (entity as any).Name
            Content(`\tcase "${lower}":
\t\treturn client.${pascal}(nil), nil
`)
          })
        })
      },
    )
  })
})


export {
  Main
}
