import { test, describe } from 'node:test'
import { ok, equal } from 'node:assert'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { TEST_JSON_FILE } from './index'


// Guards the shared corpus AS A WHOLE, which the per-section guard in the
// language runners cannot do.
//
// That guard only fires for a section some test actually runs. Seven sections
// — fetcher, makeFetchDef, makePoint, makeResult, featureAdd, featureHook and
// featureInit — had no test calling them at all, so they sat at `set: []`
// through two reviews reporting nothing. A fixture nobody runs is
// indistinguishable from a fixture that passes.
//
// Deferral is therefore DATA (`basic.pending`), not a comment: comments do not
// survive compilation to test.json, so a marker written only in the .aon
// source cannot be checked by the thing that consumes it. Being data, these
// invariants hold for every port, not just this one.
describe('Corpus', () => {

  // Resolved the same way runner.ts resolves it — from dist-test/, one level
  // up from this file's dist-test/utility/.
  const corpus = JSON.parse(
    readFileSync(join(__dirname, '..', TEST_JSON_FILE), 'utf8'))

  const primary: Record<string, any> = corpus.primary || {}
  const names = Object.keys(primary).sort()


  test('the corpus is not empty', () => {
    ok(0 < names.length, 'no primary sections found — check TEST_JSON_FILE')
  })


  // A section that compiles to zero cases must say why, in the fixture.
  test('every empty section declares why it is deferred', () => {
    const undeclared = names.filter((n) => {
      const basic = primary[n]?.basic
      return Array.isArray(basic?.set) && 0 === basic.set.length &&
        'string' !== typeof basic?.pending
    })
    equal(undeclared.join(','), '',
      'these sections compile to ZERO cases and carry no `basic: pending` ' +
      'reason — add cases, or state the blocker in .sdk/test/primary/<name>.aon')
  })


  // "PENDING" with no reason is just a way to keep a hole open.
  test('every deferral gives a real reason', () => {
    for (const n of names) {
      const pending = primary[n]?.basic?.pending
      if (null == pending) continue
      ok(20 < String(pending).length,
        `${n}: 'pending' needs a reason, not just a marker`)
    }
  })


  // The other direction: a section that has gained cases must drop its
  // deferral, or the marker rots into a lie and the runners keep excusing it.
  test('a deferred section that gained cases is promoted', () => {
    const stale = names.filter((n) => {
      const basic = primary[n]?.basic
      return null != basic?.pending && Array.isArray(basic?.set) &&
        0 < basic.set.length
    })
    equal(stale.join(','), '',
      'these sections now have cases — remove `basic: pending` from the ' +
      'fixture and from the PENDING list in the language runners')
  })


  // Every section must actually be a section: `basic.set` is what the runners
  // iterate, and a fixture that failed to compile silently loses it.
  test('every section has a basic.set list', () => {
    for (const n of names) {
      ok(Array.isArray(primary[n]?.basic?.set),
        `${n}: no basic.set list — the fixture did not compile as expected`)
    }
  })

})
