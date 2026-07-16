
import { test, describe } from 'node:test'
import { equal, ok } from 'node:assert'


import { ZefoyTiktokBotSDK } from '..'


// Network-behaviour simulation over the offline mock transport. The `test`
// feature accepts an optional `net` config so unit tests can exercise slow,
// failing and offline conditions without a live server. These checks drive
// the transport through `direct()`, which needs no entity, so they run for
// every generated SDK regardless of its API shape.
describe('netsim', () => {

  test('offline simulation fails the request', async () => {
    const sdk = ZefoyTiktokBotSDK.test({ net: { offline: true } })
    const res: any = await sdk.direct({ path: '/ping' })
    equal(res.ok, false, 'offline network must fail the call')
  })

  test('failStatus simulation surfaces the error status', async () => {
    const sdk = ZefoyTiktokBotSDK.test({ net: { failTimes: 1, failStatus: 503 } })
    const res: any = await sdk.direct({ path: '/ping' })
    equal(res.ok, false)
    equal(res.status, 503, 'simulated failure status is surfaced')
  })

  test('latency simulation delays the request', async () => {
    const delay = 60
    const sdk = ZefoyTiktokBotSDK.test({ net: { latency: delay } })
    const start = Date.now()
    await sdk.direct({ path: '/ping' })
    const elapsed = Date.now() - start
    // Generous lower bound to stay robust on slow CI.
    ok(elapsed >= delay - 25, `expected >= ${delay - 25}ms latency, got ${elapsed}ms`)
  })

  test('a plain test SDK still works with no net simulation', async () => {
    const sdk = ZefoyTiktokBotSDK.test()
    equal(null !== sdk, true)
  })
})
