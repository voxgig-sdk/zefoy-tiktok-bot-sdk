
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  // Go module path == repo path on GitHub (org from model.origin).
  const gomodule = `github.com/${model.origin || 'voxgig-sdk'}/${model.name}-sdk`

  Content(`### Data as maps

The Go SDK uses \`map[string]any\` throughout rather than typed structs.
This mirrors the dynamic nature of the API and keeps the SDK
flexible \u2014 no code generation is needed when the API schema changes.

Use \`core.ToMapAny()\` to safely cast results and nested data.

### Package structure

\`\`\`
${gomodule}/
\u251c\u2500\u2500 ${model.name}.go        # Root package \u2014 type aliases and constructors
\u251c\u2500\u2500 core/               # SDK core \u2014 client, types, pipeline
\u251c\u2500\u2500 entity/             # Entity implementations
\u251c\u2500\u2500 feature/            # Built-in features (Base, Test, Log)
\u251c\u2500\u2500 utility/            # Utility functions and struct library
\u2514\u2500\u2500 test/               # Test suites
\`\`\`

The root package (\`${gomodule}\`) re-exports everything needed
for normal use. Import sub-packages only when you need specific types
like \`core.ToMapAny\`.

`)

})


export {
  ReadmeExplanation
}
