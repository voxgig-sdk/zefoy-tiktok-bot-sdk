
import { cmp, Content, File } from '@voxgig/sdkgen'


// Generates ts/test/ReadmeExample.test.ts — a test that reads the
// repo's top-level README.md at runtime, extracts the first TS code
// block under "## Quickstart", transforms `new <Name>SDK(...)`
// to `<Name>SDK.test()` so it runs offline, evaluates the rest, and
// asserts no error. Catches drift between the README quickstart and
// the real SDK API.
const ReadmeExampleTest = cmp(function ReadmeExampleTest(props: any) {
  const { ctx$: { model } } = props
  const Name = model.const.Name

  File({ name: 'ReadmeExample.test.ts' }, () => {
    Content(`// Verifies the README's lead-language quickstart still runs.

import { describe, it } from 'node:test'
import assert from 'node:assert'
import * as Fs from 'node:fs'
import * as Path from 'node:path'

import { ${Name}SDK } from '..'


function findFirstTsBlock(md: string, sectionHeading: string): string | null {
  const escapedHeading = sectionHeading.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&')
  const re = new RegExp('##\\\\s+' + escapedHeading + '[\\\\s\\\\S]*?\`\`\`ts\\\\n([\\\\s\\\\S]*?)\`\`\`')
  const m = md.match(re)
  return m ? m[1] : null
}


function transformForTestMode(code: string, name: string): string {
  // Strip import lines — symbols come from the test's outer scope.
  let out = code.replace(/^\\s*import\\s+[^;\\n]+;?\\s*$/gm, '')
  // Swap real client construction for test mode (no network, no auth).
  out = out.replace(new RegExp('new\\\\s+' + name + 'SDK\\\\([^)]*\\\\)', 'g'), name + 'SDK.test()')
  return out
}


describe('README example', () => {
  it('lead-language quickstart runs in test mode', async () => {
    const readmePath = Path.join(__dirname, '..', '..', 'README.md')
    const md = Fs.readFileSync(readmePath, 'utf8')

    const block = findFirstTsBlock(md, 'Quickstart')
    assert(block, 'No TypeScript code block found under "## Quickstart" in README.md')

    const code = transformForTestMode(block, '${Name}')

    // Run the (transformed) example. Async, so wrap in AsyncFunction.
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const silentConsole = { log: () => {}, error: () => {}, warn: () => {} }
    const runner = new AsyncFunction('${Name}SDK', 'console', code)

    // The example should at least parse and have a valid call shape
    // (every method exists on the SDK and accepts the args shown). A
    // "Not found" / 404 from test mode means the SDK accepted the call
    // but there's no fixture for that match — that's a test-data gap,
    // not a README bug, so it's OK. Everything else (TypeError,
    // ReferenceError, SyntaxError) means the README example is out of
    // sync with the real SDK API and the test should fail.
    try {
      await runner(${Name}SDK, silentConsole)
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (/\\b(404|Not found)\\b/i.test(msg)) return
      throw err
    }
  })
})
`)
  })
})


export {
  ReadmeExampleTest
}
