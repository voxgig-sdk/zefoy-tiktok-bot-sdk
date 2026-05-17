
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


// Path to the AQL engine source. Local replace is used because the
// engine isn't yet published with a subdirectory tag (eng/vX.Y.Z).
// Once it's published, swap this for a `require` line with that
// version and delete the `replace`.
const AQL_ENG_LOCAL_PATH = '/home/richard/Projects/aql-lang/aql/eng/go'


const Main = cmp(function Main(props: any) {
  const { target } = props
  const { model } = props.ctx$

  const org = model.origin || 'voxgig-sdk'
  const sdkModule = `github.com/${org}/${model.name}-sdk/go`
  const cliModule = `github.com/${org}/${model.name}-sdk/go-cli`

  const entityMap: any = getModelPath(model, `main.${KIT}.entity`)
  const entityNames = Object.keys(entityMap).map(n => n.toLowerCase())

  const FRAGMENT = Path.normalize(__dirname + '/../../../src/cmp/go-cli/fragment')

  // .gitignore — the compiled binary lands at /<modulename>-cli; ignore it.
  File({ name: '.gitignore' }, () => Content(`/${model.name}-cli
`))

  // go.mod — sibling SDK via relative replace; aql/eng via local replace.
  File({ name: 'go.mod' }, () => Content(`module ${cliModule}

go 1.20

require ${sdkModule} v0.0.0
require github.com/aql-lang/aql/eng v0.0.0

replace ${sdkModule} => ../go
replace github.com/aql-lang/aql/eng => ${AQL_ENG_LOCAL_PATH}
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
