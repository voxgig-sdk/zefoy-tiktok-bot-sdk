
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$: { model } } = props

  Content(`# ${model.Name} ${target.title} SDK

The ${target.title} SDK for the ${model.Name} API. Provides an entity-oriented interface using standard Go conventions — no generics required, data flows as \`map[string]any\`.

`)
})


export {
  ReadmeIntro
}
