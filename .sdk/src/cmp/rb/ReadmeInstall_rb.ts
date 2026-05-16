
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  Content(`\`\`\`bash
gem install ${model.name}-sdk
\`\`\`

Or add to your \`Gemfile\`:

\`\`\`ruby
gem "${model.name}-sdk"
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
