
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

  // Derive a real entity accessor from the model for the semantic-entity
  // note (fall back to a generic name if the model has no entities).
  const entity = getModelPath(model, `main.${KIT}.entity`) || {}
  const exampleEntity = Object.values(entity).find((e: any) => e && e.active !== false) as any
  const eName = exampleEntity ? nom(exampleEntity, 'Name') : 'Entity'

  // Model-driven op list — only the operations the active entities actually
  // expose (a read-only entity has just List+Load); never claim
  // Create/Update/Remove exist when no entity has them. Go method names are
  // capitalised, so present the ops that way.
  const CANON_OPS = ['list', 'load', 'create', 'update', 'remove']
  const cap = (o: string) => o.charAt(0).toUpperCase() + o.slice(1)
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
    .map((o) => '`' + cap(o) + '`').join(', ')

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

The ${target.title} SDK for the ${model.Name} API — an entity-oriented client using standard Go conventions. No generics required; data flows as \`map[string]any\`.

It exposes the API as capitalised, semantic **Entities** — e.g. \`client.${eName}(nil)\` — each with the same small set of operations (${opList}) instead of raw URL paths and query strings. You call meaning, not endpoints, which keeps the cognitive load low.
${siblingNote}
`)
})


export {
  ReadmeIntro
}
