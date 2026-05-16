
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Data as dicts

The Python SDK uses plain dicts throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible — no code generation is needed when the API schema
changes.

Use \`helpers.to_map()\` to safely validate that a value is a dict.

### Module structure

\`\`\`
py/
├── ${model.const.Name.toLowerCase()}_sdk.py         -- Main SDK module
├── config.py                    -- Configuration
├── features.py                  -- Feature factory
├── core/                        -- Core types and context
├── entity/                      -- Entity implementations
├── feature/                     -- Built-in features (Base, Test, Log)
├── utility/                     -- Utility functions and struct library
└── test/                        -- Test suites
\`\`\`

The main module (\`${model.const.Name.toLowerCase()}_sdk\`) exports the SDK class.
Import entity or utility modules directly only when needed.

`)

})


export {
  ReadmeExplanation
}
