
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Module structure

\`\`\`
${model.name}/
├── src/
│   ├── ${model.Name}SDK.ts        # Main SDK class
│   ├── entity/             # Entity implementations
│   ├── feature/            # Built-in features (Base, Test, Log)
│   └── utility/            # Utility functions
├── test/                   # Test suites
└── dist/                   # Compiled output
\`\`\`

Import the SDK from the package root:

\`\`\`ts
import { ${model.Name}SDK } from '${model.name}'
\`\`\`

`)

})


export {
  ReadmeExplanation
}
