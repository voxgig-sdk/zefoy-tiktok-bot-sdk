
import { cmp, Content, packageName, repoInfo } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = packageName(model, 'go')
  const { releasesUrl } = repoInfo(model)

  Content(`\`\`\`bash
go get ${gomodule}@latest
\`\`\`

The Go module proxy resolves the version from the \`go/vX.Y.Z\` GitHub
release tag — see [Releases](${releasesUrl}) for the available versions.

To vendor from a local checkout instead, clone this repo alongside your
project and add a \`replace\` directive pointing at the checked-out
\`go/\` directory:

\`\`\`bash
go mod edit -replace ${gomodule}=../${model.name}-sdk/go
\`\`\`

`)
})


export {
  ReadmeInstall
}
