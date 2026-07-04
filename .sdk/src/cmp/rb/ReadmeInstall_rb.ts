
import { cmp, Content, installCommand, isPublished, packageName, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
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
    return
  }

  // Publish pending: not yet on RubyGems. Install from the git release tag.
  const { releasesUrl } = repoInfo(model)
  Content(`This package is not yet published to RubyGems. Install it from the
GitHub release tag (\`${target.name}/vX.Y.Z\`):

- Releases: [${releasesUrl}](${releasesUrl})

`)
})


export {
  ReadmeInstall
}
