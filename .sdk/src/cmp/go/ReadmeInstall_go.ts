
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeInstall = cmp(function ReadmeInstall(props: any) {
  const { target, ctx$ } = props
  const { model } = ctx$

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  Content(`\`\`\`bash
go get ${gomodule}
\`\`\`

If the module is not yet published to a registry, use a \`replace\` directive
in your \`go.mod\` to point to a local checkout:

\`\`\`bash
go mod edit -replace ${gomodule}=../path/to/${gomodule}
\`\`\`

`)
})


export {
  ReadmeInstall
}
