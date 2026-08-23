
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

  const entity = getModelPath(model, `main.${KIT}.entity`)
  const exampleEntity = Object.values(entity).find((e: any) => e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

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

  // Sibling surfaces, MODEL-DRIVEN. This line used to hardcode "the CLI, and
  // MCP server" — those are the `go-cli` and `go-mcp` targets, and this project
  // has neither. So both per-language READMEs advertised surfaces nothing here
  // generates, while the top-level Surfaces table (which does gate on active
  // targets) listed only ts/ and go/. Name what is actually active, and drop
  // the sentence entirely when this is the only surface, so it cannot outrun
  // the model again.
  const targets = getModelPath(model, `main.${KIT}.target`) || {}
  const siblings = Object.entries(targets)
    .filter(([name, t]: any) => name !== target.name && false !== t.active)
    .map(([name]: any) => name)
    .sort()

  const siblingNote = 0 === siblings.length ? '' : `
> Also generated from this model: ${siblings.map((s: string) => '`' + s + '`').join(', ')} — see
> the [top-level README](../README.md).
`

  Content(`# ${model.Name} ${target.title} SDK

${tagline}

The ${target.title} SDK for the ${model.Name} API — a type-safe, entity-oriented client with full async/await support.

The API is exposed as capitalised, semantic **Entities** — e.g.
\`client.${eName}()\` — each with a small set of operations (${opList})
instead of raw URL paths and query parameters. This keeps the surface
predictable and low-friction for both humans and AI agents.
${siblingNote}
`)
})


export {
  ReadmeIntro
}
