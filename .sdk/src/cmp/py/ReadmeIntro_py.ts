
import { cmp, Content } from '@voxgig/sdkgen'

import {
  KIT,
  getModelPath,
  nom,
} from '@voxgig/apidef'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$: { model } } = props
  const info = (model.main && model.main.kit && model.main.kit.info) || {}
  const tagline = info.tagline || ''

  Content(`# ${model.Name} ${target.title} SDK

${tagline}

The ${target.title} SDK for the ${model.Name} API — an entity-oriented client following Pythonic conventions.

`)

  // Emphasise the entity-oriented design: the SDK surfaces the API as
  // capitalised, semantic Entities with a small, uniform verb set rather
  // than raw URL paths and query strings. The example entity name is
  // derived from the model, never hardcoded.
  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity || {})
    .find((e: any) => e.active !== false) as any
  const example = exampleEntity
    ? `for example \`client.${nom(exampleEntity, 'Name')}()\` — each`
    : 'each'

  // Model-driven op list — only the operations the active entities actually
  // expose (a read-only entity has just list+load); never claim
  // create/update/remove exist when no entity has them.
  const CANON_OPS = ['list', 'load', 'create', 'update', 'remove']
  const opSet = new Set<string>()
  Object.values(entity || {}).forEach((e: any) => {
    if (!e || e.active === false) return
    Object.keys(e.op || {}).forEach((o: string) => {
      if (e.op[o] && e.op[o].active !== false) opSet.add(o)
    })
  })
  const opNames = CANON_OPS.filter((o) => opSet.has(o))
    .concat([...opSet].filter((o) => !CANON_OPS.includes(o)))
  const opList = (opNames.length ? opNames : ['list', 'load'])
    .map((o) => '`' + o + '`').join(', ')

  Content(`The SDK exposes the API as capitalised, semantic **Entities** — ${example}
carrying a small, uniform set of operations (${opList}) instead of raw URL
paths and query strings. You work with named resources and verbs, which
keeps the cognitive load low.

> Other languages, the CLI, and MCP server live alongside this one — see
> the [top-level README](../README.md).

`)
})


export {
  ReadmeIntro
}
