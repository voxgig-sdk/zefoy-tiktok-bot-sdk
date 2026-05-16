
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
composer require voxgig/${model.name}-sdk
\`\`\`

`)
})


export {
  ReadmeInstall
}
