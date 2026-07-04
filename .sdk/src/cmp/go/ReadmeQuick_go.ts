
import { cmp, Content, isAuthActive, envName } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


// Emits the go/README.md Quickstart as ONE complete, compilable program.
// Every entity operation returns `(value, error)` where `value` is the
// data itself — NOT a `{ok, data, ...}` envelope (only Direct returns
// that). So examples check `err` and use the value directly. The whole
// program is compiled by the README snippet test (readme_examples_test.go).
const ReadmeQuick = cmp(function ReadmeQuick(props: any) {
  const { target, ctx$: { model } } = props

  const entity = getModelPath(model, `main.${KIT}.entity`)
  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk/go`

  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any

  const authActive = isAuthActive(model)
  const ctor = authActive
    ? `sdk.New${model.const.Name}SDK(map[string]any{\n        "apikey": os.Getenv("${envName(model)}_APIKEY"),\n    })`
    : `sdk.New()`

  // Build the body of main() from the operations the example entity
  // supports. Each op names a fresh value var, so `:=` always declares a
  // new variable (reusing `err`), and every var is used (printed).
  const body: string[] = []
  let usesFmt = false

  if (exampleEntity) {
    const eName = nom(exampleEntity, 'Name')
    const eLower = eName.toLowerCase()
    const opnames = Object.keys(exampleEntity.op || {})

    if (opnames.includes('list')) {
      body.push(`    // List ${eLower} records — the value is the array of records itself.`)
      body.push(`    ${eLower}s, err := client.${eName}(nil).List(nil, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    for _, item := range ${eLower}s.([]any) {`)
      body.push(`        fmt.Println(item)`)
      body.push(`    }`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('load')) {
      body.push(`    // Load a single ${eLower} — the value is the loaded record.`)
      body.push(`    ${eLower}, err := client.${eName}(nil).Load(map[string]any{"id": "example_id"}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(${eLower})`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('create')) {
      body.push(`    // Create a ${eLower}.`)
      body.push(`    created, err := client.${eName}(nil).Create(map[string]any{"name": "Example"}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(created)`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('update')) {
      body.push(`    // Update a ${eLower}.`)
      body.push(`    updated, err := client.${eName}(nil).Update(map[string]any{"id": "example_id", "name": "Renamed"}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(updated)`)
      body.push(``)
      usesFmt = true
    }

    if (opnames.includes('remove')) {
      body.push(`    // Remove a ${eLower}.`)
      body.push(`    removed, err := client.${eName}(nil).Remove(map[string]any{"id": "example_id"}, nil)`)
      body.push(`    if err != nil {`)
      body.push(`        panic(err)`)
      body.push(`    }`)
      body.push(`    fmt.Println(removed)`)
      body.push(``)
      usesFmt = true
    }
  }

  // Drop trailing blank lines from the body.
  while (body.length > 0 && body[body.length - 1] === '') {
    body.pop()
  }

  const imports: string[] = []
  if (usesFmt) imports.push(`    "fmt"`)
  if (authActive) imports.push(`    "os"`)
  imports.push(`    sdk "${gomodule}"`)

  let program = `package main

import (
${imports.join('\n')}
)

func main() {
    client := ${ctor}

`
  if (body.length > 0) {
    program += body.join('\n') + '\n'
  } else {
    program += `    _ = client\n`
  }
  program += `}`

  Content(`### Quickstart

A complete program: create a client, then call the entity operations.
Each operation returns \`(value, error)\` — the value is the data itself
(there is no \`{ok, data}\` wrapper), so check \`err\` and use the value
directly.

\`\`\`go
${program}
\`\`\`

`)

})


export {
  ReadmeQuick
}
