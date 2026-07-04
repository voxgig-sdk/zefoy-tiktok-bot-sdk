
import { cmp, Content, installCommand, isPublished, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

`)
    return
  }

  // Publish pending: not yet on Packagist. Install from the git release tag.
  const { releasesUrl } = repoInfo(model)
  Content(`This package is not yet published to Packagist. Install it from the
GitHub release tag (\`${target.name}/vX.Y.Z\`):

- Releases: [${releasesUrl}](${releasesUrl})

`)
})


export {
  ReadmeInstall
}
