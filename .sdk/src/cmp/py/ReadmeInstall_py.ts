
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
pip install ${model.name}-sdk
\`\`\`

Or install from source:

\`\`\`bash
pip install -e .
\`\`\`

`)
})


export {
  ReadmeInstall
}
