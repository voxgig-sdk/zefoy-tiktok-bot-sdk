
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

  // README.md — usage guide for the MCP server.
  const firstEntity = entityNames[0] || 'entity'
  File({ name: 'README.md' }, () => Content(`# ${model.name}-mcp

MCP server exposing the ${model.Name} SDK as tools, built on the
[official Go MCP SDK](https://github.com/modelcontextprotocol/go-sdk)
and the sibling Go SDK at \`../go\`.

## Tools

| Tool | Args | Returns |
|------|------|---------|
| \`${slugLower}_list\` | \`entity\`, optional \`query\` map | First page of records as JSON |
| \`${slugLower}_load\` | \`entity\`, \`query\` (e.g. \`{id:N}\`) | Single record as JSON |

JSON schemas for both tools are emitted by the SDK from the \`Args\`
struct's \`json\` / \`jsonschema\` tags — no schema is hand-written.

## Entities

${entityHelp}

## Build

\`\`\`sh
go build -o ${model.name}-mcp ./...
\`\`\`

## Run

\`\`\`sh
# stdio transport — for spawnable agent installs (default).
./${model.name}-mcp

# streamable HTTP transport — share one running server between agents.
./${model.name}-mcp -transport http -addr :8080
\`\`\`

## Install for Claude Code

\`\`\`sh
claude mcp add --scope user ${slugLower} \\
  -- /absolute/path/to/${model.name}-mcp -transport stdio
\`\`\`

After install, restart Claude Code; the \`${slugLower}_list\` and
\`${slugLower}_load\` tools become available in new sessions.

## Smoke test via HTTP

\`\`\`sh
./${model.name}-mcp -transport http -addr :18080 &

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
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"${slugLower}_load","arguments":{"entity":"${firstEntity}","query":{"id":1}}}}'
\`\`\`

## Generated by

sdkgen \`go-mcp\` target. See the target source under
\`.sdk/src/cmp/go-mcp/\` in this repo, or upstream at
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
