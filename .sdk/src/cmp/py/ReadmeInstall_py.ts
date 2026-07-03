
import { cmp, Content, installCommand } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
${installCommand(model, target.name)}
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
