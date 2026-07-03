
import { cmp, Content, installCommand, packageName } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or add to your \`Gemfile\`:

\`\`\`ruby
gem "${packageName(model, 'gem')}"
\`\`\`

Then run:

\`\`\`bash
bundle install
\`\`\`

`)
})


export {
  ReadmeInstall
}
