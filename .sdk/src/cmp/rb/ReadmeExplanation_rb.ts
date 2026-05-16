
import { cmp, Content } from '@voxgig/sdkgen'


const ReadmeExplanation = cmp(function ReadmeExplanation(props: any) {
  const { target, ctx$: { model } } = props

  Content(`### Data as hashes

The Ruby SDK uses plain Ruby hashes throughout rather than typed
objects. This mirrors the dynamic nature of the API and keeps the
SDK flexible — no code generation is needed when the API schema
changes.

Use \`Helpers.to_map()\` to safely validate that a value is a hash.

### Module structure

\`\`\`
rb/
├── ${model.const.Name}_sdk.rb       -- Main SDK module
├── config.rb                  -- Configuration
├── features.rb                -- Feature factory
├── core/                      -- Core types and context
├── entity/                    -- Entity implementations
├── feature/                   -- Built-in features (Base, Test, Log)
├── utility/                   -- Utility functions and struct library
└── test/                      -- Test suites
\`\`\`

The main module (\`${model.const.Name}_sdk\`) exports the SDK class
and test helper. Import entity or utility modules directly only
when needed.

`)

})


export {
  ReadmeExplanation
}
