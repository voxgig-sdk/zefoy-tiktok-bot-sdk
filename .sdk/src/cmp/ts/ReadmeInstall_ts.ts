
import { cmp, Content, installCommand, isPublished, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content('```bash')
    Content(`
${installCommand(model, target.name)}
`)
    Content('```')
    return
  }

  // Publish pending: the package is not yet on npm, so install from the
  // git release tag instead of a `npm install` that would 404.
  const { releasesUrl } = repoInfo(model)
  Content(`This package is not yet published to npm. Install it from the GitHub
release tag (\`${target.name}/vX.Y.Z\`):

- Releases: [${releasesUrl}](${releasesUrl})

`)
})


export {
  ReadmeInstall
}
