
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Module structure

\`\`\`
${model.name}/
├── src/
│   ├── ${model.Name}SDK.js        # Main SDK class
│   ├── entity/             # Entity implementations
│   ├── feature/            # Built-in features (Base, Test, Log)
│   └── utility/            # Utility functions
└── test/                   # Test suites
\`\`\`

Import the SDK from the package root:

\`\`\`js
const { ${model.Name}SDK } = require('${model.name}')
\`\`\`

`)

})


export {
  ReadmeExplanation
}
