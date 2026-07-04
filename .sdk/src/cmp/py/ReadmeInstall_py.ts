
import { cmp, Content, installCommand, isPublished, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  if (isPublished(model, target.name)) {
    Content(`\`\`\`bash
${installCommand(model, target.name)}
\`\`\`

Or install from source:

\`\`\`bash
pip install -e .
\`\`\`

`)
    return
  }

  // Publish pending: not yet on PyPI. Install from the git release tag or
  // from a local source checkout.
  const { releasesUrl } = repoInfo(model)
  Content(`This package is not yet published to PyPI. Install it from the GitHub
release tag (\`${target.name}/vX.Y.Z\`, see [Releases](${releasesUrl})) or
from a source checkout:

\`\`\`bash
pip install -e .
\`\`\`

`)
})


export {
  ReadmeInstall
}
