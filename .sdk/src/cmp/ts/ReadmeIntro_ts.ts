
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeIntro = cmp(function ReadmeIntro(props: any) {
  const { target, ctx$: { model } } = props

  Content(`# ${model.Name} ${target.title} SDK

The ${target.title} SDK for the ${model.Name} API. Provides a type-safe, entity-oriented interface with full async/await support.

`)
})


export {
  ReadmeIntro
}
