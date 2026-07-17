
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


// Published aql/eng/go version. Tagged at aql-lang/aql under
// eng/go/v<X.Y.Z>. Bump here when adopting a newer engine.
const AQL_ENG_VERSION = 'v0.0.1'

// go.sum entries for AQL_ENG_VERSION and its transitive deps. The sibling
// SDK dep needs no entry (path replace). Deterministic because the version
// is pinned above — regenerate with `go mod tidy` and update BOTH constants
// together when bumping AQL_ENG_VERSION.
const AQL_ENG_GOSUM = `github.com/aql-lang/aql/eng/go v0.0.1 h1:qvopmpIX5xL6cpAC4otSUO7fUDA46x/y+2lT2zoxTaA=
github.com/aql-lang/aql/eng/go v0.0.1/go.mod h1:7LmNG+pASY2jlPZB0iFAt/ZNdmc8qxvaf+njVmaSFks=
github.com/jsonicjs/jsonic/go v0.1.6 h1:oUw4vxCK6tqa7SGN87vjCtx3sCpeHXdqfl25hx5LKP0=
github.com/jsonicjs/jsonic/go v0.1.6/go.mod h1:ObNKlCG7esWoi4AHCpdgkILvPINV8bpvkbCd4llGGUg=
`


const Main = cmp(function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const org = model.origin || 'voxgig-sdk'
  const sdkModule = `github.com/${org}/${model.name}-sdk/go`
  const cliModule = `github.com/${org}/${model.name}-sdk/go-cli`

  const entityMap: any = getModelPath(model, `main.${KIT}.entity`)
  const entityNames = Object.keys(entityMap).map(n => n.toLowerCase())

  const FRAGMENT = Path.normalize(__dirname + '/../../../src/cmp/go-cli/fragment')

  // .gitignore — build output (dist/) and any stray top-level binaries.
  File({ name: '.gitignore' }, () => Content(`/dist/
/${model.name}-cli
/go-cli
`))

  // ==========================================================================
  // README.md — Diátaxis-structured, examples-first usage guide.
  //
  // EVERYTHING here is MODEL-DRIVEN: verbs, examples and how-to sections are
  // gated on whether an active entity actually exposes that op
  // (op.<name>.active !== false) — never document an operation no entity
  // supports. The CLI implements three AQL words (list / load / update; see
  // words.fragment.go + runOp).
  // ==========================================================================
  const bin = `${model.name}-cli`
  const entityList = entityNames.length > 0 ? entityNames.join(' ') : '(none)'
  const entityCount = entityNames.length

  const projUpper = String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_')
  const apiKeyEnv = projUpper + '_APIKEY'
  const baseEnv = projUpper + '_BASE'

  const CLI_VERB_ROWS: Record<string, string> = {
    list:   '| `list`   | `list <entity>` · `list <query> <entity>`     | First page of records          |',
    load:   '| `load`   | `load <entity>` · `load <query> <entity>`     | A single record                |',
    update: '| `update` | `update <query> <entity>`                     | Update a record, return it     |',
  }
  const supportedOps = new Set<string>()
  each(entityMap, (entity: any) => {
    if (entity && entity.active === false) return
    const ops = (entity && entity.op) || {}
    for (const opname of Object.keys(ops)) {
      if (ops[opname] && ops[opname].active !== false) supportedOps.add(opname)
    }
  })
  const verbRows = ['list', 'load', 'update']
    .filter(op => supportedOps.has(op))
    .map(op => CLI_VERB_ROWS[op])
    .join('\n')

  // First / second active entity for concrete, truthful examples, gated on
  // the FIRST entity's own ops so an example never shows a verb it lacks.
  const activeEntityObjs: any[] =
    Object.values(entityMap).filter((e: any) => e && e.active !== false)
  const firstEntityObj: any = activeEntityObjs[0]
  const firstEntity = firstEntityObj
    ? String(firstEntityObj.name).toLowerCase()
    : (entityNames[0] || 'entity')
  const secondEntity = activeEntityObjs.length > 1
    ? String(activeEntityObjs[1].name).toLowerCase()
    : firstEntity
  const firstOps: any = (firstEntityObj && firstEntityObj.op) || {}
  const firstHas = (op: string) => !!(firstOps[op] && firstOps[op].active !== false)
  const entityNoun = entityCount === 1 ? 'entity' : 'entities'
  // The best single example expression this SDK can actually run, for the
  // tutorial/REPL walkthroughs (never demonstrates an unsupported op).
  const firstExampleExpr =
    firstHas('list') ? `list ${firstEntity}` :
    firstHas('load') ? `load 1 ${firstEntity}` :
    firstHas('update') ? `update '{id:1}' ${firstEntity}` : ':help'

  // ---- Examples block (up front) -------------------------------------------
  const ex: string[] = []
  ex.push(`# 1. Build a native binary (-> dist/<os>-<arch>/${bin})`)
  ex.push('make build')
  ex.push('')
  ex.push('# 2. Provide credentials once, via the environment')
  ex.push(`export ${apiKeyEnv}=sk_live_xxx`)
  ex.push('')
  ex.push('# 3. Each command line is ONE AQL expression, run against the API:')
  if (firstHas('list')) ex.push(`./${bin} list ${firstEntity}`)
  if (firstHas('load')) {
    ex.push(`./${bin} load 1 ${firstEntity}            # {id:1} shorthand`)
    ex.push(`./${bin} load '{id:1}' ${firstEntity}       # explicit match map`)
  }
  if (firstHas('update')) ex.push(`./${bin} update '{name:"x"}' ${firstEntity}`)
  if (firstHas('list') && secondEntity !== firstEntity) {
    ex.push(`./${bin} list ${secondEntity}`)
  }
  ex.push('')
  ex.push('# 4. Override the API base URL for a single call')
  ex.push(`${baseEnv}=https://api.example.com ./${bin} ${firstExampleExpr}`)
  ex.push('')
  ex.push('# 5. No arguments -> interactive REPL')
  ex.push(`./${bin}`)
  ex.push(`${model.name}> ${firstExampleExpr}`)
  ex.push(`${model.name}> :quit`)
  const exampleBlock = ex.join('\n')

  // ---- How-to guides (gated) -----------------------------------------------
  const howtos: string[] = []
  if (firstHas('list')) howtos.push(`### List the records of an entity

\`\`\`sh
./${bin} list ${firstEntity}
\`\`\`

\`list <entity>\` returns the first page of records. \`<entity>\` is a bareword —
it is auto-quoted as an AQL atom, so no quotes are needed.`)

  if (firstHas('load')) howtos.push(`### Load a single record

\`\`\`sh
./${bin} load 1 ${firstEntity}          # scalar shorthand for {id:1}
./${bin} load '{id:1}' ${firstEntity}     # explicit match map
\`\`\`

The query is either a **scalar** (\`1\`, treated as \`{id:1}\`) or a **match map**
(\`{id:1}\`, \`{slug:"acme"}\`). Quote the map so your shell passes it through intact.`)

  if (firstHas('update')) howtos.push(`### Update a record

\`\`\`sh
./${bin} update '{id:1,name:"new"}' ${firstEntity}
\`\`\`

The match map carries both the selector and the new field values; the updated
record is printed back.`)

  howtos.push(`### Authenticate and choose an environment

Configuration is read from the environment — nothing is written to disk:

\`\`\`sh
export ${apiKeyEnv}=sk_live_xxx            # API key
export ${baseEnv}=https://api.example.com  # optional: override the API base URL
./${bin} ${firstExampleExpr}
\`\`\`

Both are injectable by a secrets vault, so the key never has to be typed inline.`)

  howtos.push(`### Explore interactively with the REPL

Run with no arguments to open a REPL (prompt \`${model.name}>\`). Each line is
evaluated as its own AQL expression:

\`\`\`text
$ ./${bin}
${model.name}> ${firstExampleExpr}
${model.name}> :help
${model.name}> :quit
\`\`\``)

  howtos.push(`### Cross-compile release binaries

\`\`\`sh
make build       # native binary for this machine
make build-all   # linux/darwin/windows x amd64/arm64, under dist/<os>-<arch>/
\`\`\``)

  howtos.push(`### Discover the available entities

\`:help\` in the REPL prints the full entity list, or see [Entities](#entities)
below — this SDK exposes ${entityCount} ${entityNoun}.`)

  const howtoBlock = howtos.join('\n\n')

  File({ name: 'README.md' }, () => Content(`# ${model.name}-cli

AQL-driven command-line client **and** interactive REPL for the ${model.Name}
SDK. Each command line is parsed as a single [AQL](https://github.com/aql-lang/aql)
expression and evaluated against the live API; run it with no arguments to drop
into a REPL. Built on \`github.com/aql-lang/aql/eng/go\` and the sibling Go SDK
at \`../go\`.

## Examples

\`\`\`sh
${exampleBlock}
\`\`\`

> The rest of this guide follows the [Diátaxis](https://diataxis.fr) framework:
> a hands-on **Tutorial**, task-focused **How-to guides**, a factual
> **Reference**, and background **Explanation**.

## Tutorial: your first query in under a minute

1. **Build the binary.** From this \`go-cli/\` directory:

   \`\`\`sh
   make build          # -> dist/<os>-<arch>/${bin}
   \`\`\`

2. **Set your API key** (read from the environment):

   \`\`\`sh
   export ${apiKeyEnv}=sk_live_xxx
   \`\`\`

3. **Run a query.** Evaluate an AQL expression against the API (or run with no
   arguments to open the REPL):

   \`\`\`sh
   ./dist/*/${bin} ${firstExampleExpr}
   \`\`\`

4. **Go interactive.** Run the binary with no arguments to open the REPL, then
   type \`:help\` for the word and entity lists and \`:quit\` to leave.

That is the whole loop: *build → set key → evaluate AQL expressions*.

## How-to guides

${howtoBlock}

## Reference

### Words

The CLI registers these AQL words, each bound to the SDK:

| Word     | Signatures                                    | Returns                        |
|----------|-----------------------------------------------|--------------------------------|
${verbRows}

- \`<entity>\` is a bareword, auto-quoted as an AQL atom (e.g. \`${firstEntity}\`).
- \`<query>\` is either a **Map** (\`{id:1}\`) or a **Scalar** (\`1\`, treated as
  \`{id:1}\`). A scalar is always wrapped as \`{id:<value>}\`.

### Environment variables

| Variable | Purpose |
|----------|---------|
| \`${apiKeyEnv}\` | API key sent with every request. |
| \`${baseEnv}\` | Optional override of the API base URL. |

Unset variables fall back to the SDK's built-in defaults.

### REPL commands

- \`:quit\` / \`:q\` / \`:exit\` — exit the REPL
- \`:help\` / \`:h\` / \`:?\`     — show the word list, entity list and meta commands

### Exit codes

| Code | Meaning |
|------|---------|
| \`0\` | Success (also the normal REPL exit). |
| \`1\` | Parse error, word-registration error, or an API/evaluation error. |

### Build targets

| Target | Result |
|--------|--------|
| \`make build\` | Native binary at \`dist/<os>-<arch>/${bin}\`. |
| \`make build-all\` | linux/darwin/windows x amd64/arm64, each under its own \`dist/<os>-<arch>/\`. |
| \`make clean\` | Remove \`dist/\` and any stray binaries. |

### Entities

The ${entityCount} ${entityNoun} this SDK exposes (any is valid as \`<entity>\`):

${entityList}

## Explanation

### Why AQL?

The whole command line is one [AQL](https://github.com/aql-lang/aql) expression,
not a fixed \`verb --flag\` grammar. That means the same binary works one-shot
(\`./${bin} <expr>\`) and interactively (the REPL), and expressions compose the
same way in both. \`list\` / \`load\` / \`update\` are ordinary AQL *words* bound to
the SDK — adding SDK operations is adding words, not re-parsing flags.

### How it is wired

\`main.go\` builds the SDK client (configured from the environment), creates an
AQL registry, and \`words.go\` registers \`list\` / \`load\` / \`update\` as native
words that dispatch on the entity atom and call the sibling Go SDK at \`../go\`.
Results are unwrapped from their \`Entity\` wrappers to plain data before being
printed.

### Output format

Each result value is printed as its AQL string form (a JSON-like rendering of
the record or list of records). One-shot mode prints to stdout; errors go to
stderr with a non-zero exit code.

## Generated by

sdkgen \`go-cli\` target. See the target source under \`.sdk/src/cmp/go-cli/\` in
this repo, or upstream at
\`github.com/voxgig/sdkgen/project/.sdk/src/cmp/go-cli/\`.
`))

  // go.mod — sibling SDK via relative replace; aql/eng/go from the
  // public Go module proxy. The go directive must be >= aql/eng/go's own
  // (go 1.24.7 at eng/go/v0.0.1) — keep in step with AQL_ENG_VERSION.
  File({ name: 'go.mod' }, () => Content(`module ${cliModule}

go 1.24.7

require ${sdkModule} v0.0.0
require github.com/aql-lang/aql/eng/go ${AQL_ENG_VERSION}

require github.com/jsonicjs/jsonic/go v0.1.6 // indirect

replace ${sdkModule} => ../go
`))

  // go.sum — required for `go build` to accept the aql/eng/go dependency
  // (the path-replaced sibling SDK needs no entry). Pinned alongside
  // AQL_ENG_VERSION above.
  File({ name: 'go.sum' }, () => Content(AQL_ENG_GOSUM))

  // Makefile — `make build` for the current machine, `make build-all` to
  // cross-compile for the three desktop OSes (linux, darwin, windows) on
  // amd64 + arm64. Every binary is named ${model.name}-cli (+ .exe on windows)
  // inside its own dist/<os>-<arch>/ folder — no loose top-level binary.
  File({ name: 'Makefile' }, () => Content(`# ${model.name}-cli build. GENERATED by @voxgig/sdkgen go-cli target.
BINARY := ${model.name}-cli
DIST := dist
GOOS := $(shell go env GOOS)
GOARCH := $(shell go env GOARCH)
EXT := $(if $(filter windows,$(GOOS)),.exe,)

.PHONY: build build-all clean

# Native build for the current machine -> dist/<os>-<arch>/${model.name}-cli.
build:
\tgo build -o $(DIST)/$(GOOS)-$(GOARCH)/$(BINARY)$(EXT) .

# Cross-compiled release binaries: three desktop OSes x amd64/arm64, each named
# ${model.name}-cli (+ .exe on windows) inside its own dist/<os>-<arch>/ folder.
build-all: clean
\tGOOS=linux   GOARCH=amd64 go build -o $(DIST)/linux-amd64/$(BINARY) .
\tGOOS=linux   GOARCH=arm64 go build -o $(DIST)/linux-arm64/$(BINARY) .
\tGOOS=darwin  GOARCH=amd64 go build -o $(DIST)/darwin-amd64/$(BINARY) .
\tGOOS=darwin  GOARCH=arm64 go build -o $(DIST)/darwin-arm64/$(BINARY) .
\tGOOS=windows GOARCH=amd64 go build -o $(DIST)/windows-amd64/$(BINARY).exe .
\tGOOS=windows GOARCH=arm64 go build -o $(DIST)/windows-arm64/$(BINARY).exe .

clean:
\trm -rf $(DIST) $(BINARY) go-cli
`))

  // main.go — produced from fragment/main.fragment.go with two Slots
  // for the prompt label and the entity help line.
  File({ name: 'main.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'main.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
          // Env vars the CLI reads: <PROJ>_APIKEY for the key and <PROJ>_BASE
          // to override the API base URL (both injectable by a secrets vault).
          APIKEYENVVAR: String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_APIKEY',
          BASEENVVAR: String(model.name).toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_BASE',
        },
      },
      () => {
        Slot({ name: 'promptName' }, () => Content(model.name))
        Slot({ name: 'entityNamesSpaced' }, () => Content(entityNames.join(' ')))
      },
    )
  })

  // words.go — produced from fragment/words.fragment.go with a single
  // Slot that emits one `case "<name>":` per entity.
  File({ name: 'words.go' }, () => {
    Fragment(
      {
        from: Path.join(FRAGMENT, 'words.fragment.go'),
        replace: {
          ...props.ctx$.stdrep,
          GOMODULE: sdkModule,
        },
      },
      () => {
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
